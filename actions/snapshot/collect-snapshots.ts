"use server";

import type { Client, PlatformConnection, Snapshot } from "@/generated/prisma/browser";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { DAY_MS, REFRESH_THRESHOLD_DAYS } from "@/lib/constants";
import { renderConnectionExpiredEmail } from "@/lib/email/render-connection-expired";
import { getTranslations } from "next-intl/server";
import { PLATFORM_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { resolveSyncedAccounts, type UpsertOutcome } from "@/lib/snapshot/resolve-synced-accounts";
import { logSyncError } from "@/lib/sync-error";
import { err, ok, sink } from "@/lib/try-catch";
import { listAccounts } from "@/lib/zernio/accounts";
import { listAdAccounts } from "@/lib/zernio/ads";
import { upsertAdAccounts } from "@/lib/zernio/finish-connection";
import pLimit from "p-limit";
import { fetchSnapshot } from "./fetch-snapshot";

// Global cap on concurrent Zernio timeline fetches. Module-level, so it bounds the WHOLE run
// (every account of every client), not each client in isolation — one big client can use the full
// budget when others are idle, and total in-flight requests stay bounded regardless of client mix.
//
// This is a balance, not a max-it-out: too low and a 20-account client serializes into many waves
// that overrun the cron budget (the Jul blackout); too high and a burst of simultaneous requests
// trips Zernio's rate limit, whose 429 → retry-with-backoff then costs more wall-clock than the
// waves saved. 20 clears today's largest client in ~one wave while still capping a future
// hundreds-of-accounts client. Override with ZERNIO_FETCH_CONCURRENCY once Zernio's real limit is
// known — no deploy needed.
const FETCH_CONCURRENCY = Number(process.env.ZERNIO_FETCH_CONCURRENCY) || 20;
const fetchLimit = pLimit(FETCH_CONCURRENCY);

// Concurrency cap for the per-day snapshot upserts (see the upsert loop). Each upsert is an
// independent, idempotent, autocommitted write — no wrapping transaction — so they run in parallel,
// bounded here so a huge first-time backfill (hundreds of days × dozens of accounts) can't exhaust
// the Prisma connection pool. Override with SNAPSHOT_UPSERT_CONCURRENCY — no deploy needed.
const UPSERT_CONCURRENCY = Number(process.env.SNAPSHOT_UPSERT_CONCURRENCY) || 10;
const upsertLimit = pLimit(UPSERT_CONCURRENCY);

/**
 * The parts of a Client this pipeline actually reads: its id, the Zernio profile that owns its
 * connections, and the name/email/locale the connection-expired notice is addressed and written in.
 *
 * Narrower than `Client` on purpose. The daily cron loads EVERY active client up front, so the row
 * shape is worth stating; more usefully, adding a `client.locale` read here now fails typecheck until
 * the caller's `select` is widened to match, instead of silently working because the caller happened to
 * pass a full row.
 */
export type SnapshotClient = Pick<Client, "id" | "zernio_profile_id" | "name" | "email" | "locale">;

export async function collectSnapshots(client: SnapshotClient): Promise<Result<Snapshot[], string>> {
    // Backfill ad accounts from Zernio before pulling. Zernio's ad-account listing lags the grant,
    // so a connection can be legitimately recorded with zero ad accounts (or gain new ones later);
    // without this the snapshot pull below would never see them, since it only iterates ad accounts
    // already in our DB. Best-effort — a failure here must not abort collection.
    if (client.zernio_profile_id) {
        try {
            await refreshAdAccounts(client.id);
        } catch (error) {
            console.error(`Ad-account refresh failed for client ${client.id}:`, error);
            await logSyncError({ stage: "refresh_ad_accounts", clientId: client.id, message: String(error) });
        }
    }

    const adAccounts = await prisma.adAccount.findMany({
        where: { active: true, connection: { client_id: client.id } },
        include: { connection: true },
    });

    // Sync connection health from Zernio (replaces token-expiry tracking). Disconnected grants are
    // flipped to DISCONNECTED and the client is asked to reconnect; recovered ones flip back. A
    // health-check failure must never abort collection.
    let disconnectedIds = new Set<number>();
    if (client.zernio_profile_id) {
        try {
            disconnectedIds = await syncConnectionHealth(client);
        } catch (error) {
            console.error(`Connection health check failed for client ${client.id}:`, error);
            await logSyncError({ stage: "health_check", clientId: client.id, message: String(error) });
        }
    }

    // Pull only for healthy, Zernio-backed connections.
    const usable = adAccounts.filter(
        (a) => a.connection.zernio_account_id != null && !disconnectedIds.has(a.connection.id),
    );

    const results = await Promise.all(usable.map((a) => fetchLimit(() => fetchSnapshot(a))));
    const [batches, errors] = sink(results);

    // Promise.all preserves order, so results are index-aligned with usable. Zero-row fetches
    // (ok([]), normal right after connect) still count as synced.
    const okAccountIds = usable.filter((_, i) => !results[i].error).map((a) => a.id);
    console.log(
        `[snapshots] client=${client.id} accounts=${usable.length} ok=${okAccountIds.length} failed=${errors.length}`,
    );

    if (errors.length > 0) {
        errors.forEach((e) => console.error(`Snapshot fetch failed: ${e}`));

        if (batches.length === 0) {
            return err(`No successful snapshot fetch for client '${client.id}', but there were errors (check logs).`);
        }
    }

    const inputs = batches.flat();
    if (inputs.length === 0) {
        await stampSynced(okAccountIds);
        return ok([]);
    }

    // Per-day upserts, each its own autocommitted statement — deliberately NOT wrapped in a
    // $transaction. Keyed on the @@unique([start_date, ad_account_id]); a re-fetched trailing day
    // overwrites (createMany/skipDuplicates can't update an existing day). The writes need no
    // cross-day atomicity — the run already tolerates partial persistence and re-pulls the rest next
    // time — and the old per-chunk $transaction was actively harmful: a large first-time backfill
    // (hundreds of days × dozens of accounts) overran Prisma's 5s interactive-transaction cap
    // (P2028), so the chunk rolled back, the client committed NOTHING, and it never advanced past
    // that first chunk (client 5 sat fully un-synced this way). Autocommitting each row means
    // partial progress sticks, so a backfill too big for one 60s run just shrinks the backlog every
    // run until it completes. Concurrency-bounded by upsertLimit.
    try {
        const settled = await Promise.allSettled(
            inputs.map((input) =>
                upsertLimit(() =>
                    prisma.snapshot.upsert({
                        where: {
                            start_date_ad_account_id: {
                                start_date: input.start_date,
                                ad_account_id: input.ad_account_id,
                            },
                        },
                        create: input,
                        update: { data: input.data, platform: input.platform },
                    }),
                ),
            ),
        );

        const snapshots: Snapshot[] = [];
        const outcomes: UpsertOutcome[] = [];
        let firstError: unknown = null;
        settled.forEach((outcome, i) => {
            const ok = outcome.status === "fulfilled";
            outcomes.push({ adAccountId: inputs[i].ad_account_id, ok });
            if (outcome.status === "fulfilled") snapshots.push(outcome.value);
            else firstError ??= outcome.reason;
        });

        // Stamp only accounts whose every upsert landed; a partially-upserted account stays "stale"
        // so the trailing re-pull heals it next run and the stale-account query stays honest.
        const { syncedAccountIds, failedAccountIds } = resolveSyncedAccounts(outcomes, okAccountIds);
        await stampSynced(syncedAccountIds);

        console.log(
            `[snapshots] client=${client.id} rows=${inputs.length} upserted=${snapshots.length} failed=${failedAccountIds.length} accounts`,
        );

        if (failedAccountIds.length > 0) {
            const message = `Failed to upsert some snapshots for client '${client.id}': ${failedAccountIds.length} account(s) errored (committed ${snapshots.length}/${inputs.length} rows, will re-pull next run). First error: ${String(firstError)}`;
            await logSyncError({ stage: "upsert_snapshots", clientId: client.id, message });
            return err(message);
        }

        return ok(snapshots);
    } catch (error) {
        const message = `Failed to upsert snapshots for client '${client.id}': ${String(error)}`;
        await logSyncError({ stage: "upsert_snapshots", clientId: client.id, message });
        return err(message);
    }
}

/** Marks accounts whose fetch+upsert round-tripped, for "which account silently stopped syncing" queries. */
async function stampSynced(adAccountIds: number[]): Promise<void> {
    if (adAccountIds.length === 0) return;
    try {
        await prisma.adAccount.updateMany({
            where: { id: { in: adAccountIds } },
            data: { last_synced_at: new Date() },
        });
    } catch (error) {
        console.error("Failed to stamp last_synced_at:", error);
    }
}

/**
 * Re-lists ad accounts from Zernio for each Zernio-backed connection and upserts any new ones. This
 * catches accounts that appeared after connect (Zernio's ad-account sync lags the grant) as well as
 * accounts added later, without requiring a manual reconnect. Existing rows are left in place — this
 * only adds/updates, it does not deactivate accounts that vanished from Zernio.
 */
async function refreshAdAccounts(clientId: number): Promise<void> {
    const connections = await prisma.platformConnection.findMany({
        where: { client_id: clientId, status: "CONNECTED", zernio_account_id: { not: null } },
        select: { id: true, zernio_account_id: true },
    });

    for (const connection of connections) {
        if (!connection.zernio_account_id) continue;
        try {
            const accounts = await listAdAccounts(connection.zernio_account_id);
            await upsertAdAccounts(connection.id, accounts);
        } catch (error) {
            console.error(`Failed to refresh ad accounts for connection ${connection.id}:`, error);
        }
    }
}

/**
 * Reconciles each connection's status against Zernio's view. Returns the set of connection ids that
 * are currently disconnected (so the caller can skip pulling them). Flips PlatformConnection.status
 * in the DB and notifies the client once per disconnected connection.
 *
 * The connections are loaded HERE rather than derived from the caller's ad-account list, which is
 * the bug this replaces: the caller passes `adAccounts.map(a => a.connection)`, so a grant with no
 * ad accounts — or whose ad accounts are all inactive — was never in the list and therefore never
 * reconciled. It sat at CONNECTED forever no matter what Zernio said. That is not a corner case: a
 * password change kills the grant, `refreshAdAccounts` (which itself only looks at CONNECTED
 * connections) then can't list anything under it, and a client who has since deactivated their
 * accounts has nothing left to carry the connection into this function at all.
 */
async function syncConnectionHealth(client: SnapshotClient): Promise<Set<number>> {
    const profileId = client.zernio_profile_id;
    const disconnectedConnectionIds = new Set<number>();
    if (!profileId) return disconnectedConnectionIds;

    const disconnected = await listAccounts(profileId, "disconnected");
    const disconnectedZernioIds = new Set(disconnected.map((a) => a._id));

    // Every Zernio-backed connection the client has, in either status: a DISCONNECTED one must stay
    // in scope so it can be flipped back once the client reconnects.
    const connections = await prisma.platformConnection.findMany({
        where: { client_id: client.id, zernio_account_id: { not: null } },
    });

    for (const connection of connections) {
        const isDisconnected =
            connection.zernio_account_id != null && disconnectedZernioIds.has(connection.zernio_account_id);
        const nextStatus = isDisconnected ? "DISCONNECTED" : "CONNECTED";

        if (connection.status !== nextStatus) {
            await prisma.platformConnection.update({ where: { id: connection.id }, data: { status: nextStatus } });
        }

        if (isDisconnected) {
            disconnectedConnectionIds.add(connection.id);
            try {
                await notifyConnectionExpired(client, connection);
            } catch (error) {
                console.error(`Failed to notify client ${client.id} of disconnected connection:`, error);
            }
        }
    }

    return disconnectedConnectionIds;
}

/**
 * In-app + email notice that a connection is disconnected and the client needs to reconnect.
 * Rate-limited to once per REFRESH_THRESHOLD_DAYS per client so a persistently-dead connection
 * doesn't email them every day. (A client holds at most one connection per platform today, so this
 * is effectively per-connection; revisit the dedupe key if that changes.) Delivery failures are
 * logged, never thrown — they must not fail snapshot collection.
 */
async function notifyConnectionExpired(client: SnapshotClient, connection: PlatformConnection): Promise<void> {
    const since = new Date(Date.now() - REFRESH_THRESHOLD_DAYS * DAY_MS);
    const recent = await prisma.notification.findFirst({
        where: { client_id: client.id, type: "CONNECTION_EXPIRED", created_at: { gte: since } },
        select: { id: true },
    });
    if (recent) return;

    const platformLabel = PLATFORM_META[connection.platform].label;
    const link = "/dashboard/account";
    // Concrete language, resolved once for both the notification and the email below. The cron has no
    // request to detect from, which is why Client.locale is always a real language.
    const locale = isLocale(client.locale) ? client.locale : DEFAULT_LOCALE;

    try {
        // Localized at write time, not read time — matching the batch notification in
        // lib/report/send-batch.ts. These columns are plain strings, so the language is baked in when
        // the row is created; a client who later switches language keeps old notices as they were.
        const t = await getTranslations({ locale, namespace: "notifications.connectionExpired" });

        await prisma.notification.create({
            data: {
                client_id: client.id,
                type: "CONNECTION_EXPIRED",
                title: t("title", { platform: platformLabel }),
                body: t("body", { platform: platformLabel }),
                link,
            },
        });
    } catch (error) {
        console.error(`Failed to create CONNECTION_EXPIRED notification for client ${client.id}:`, error);
    }

    try {
        const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
        const reconnectUrl = base ? `${base}${link}` : link;
        const email = await renderConnectionExpiredEmail({ clientName: client.name, platformLabel, reconnectUrl, locale });

        // Lazy import so a missing/invalid RESEND_API_KEY can't crash snapshot collection.
        const { resend } = await import("@/lib/resend");
        const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM ?? "Repolio <team@gj-automate.com>",
            to: client.email,
            subject: email.subject,
            html: email.html,
        });
        if (error) console.error(`Resend rejected connection-expired email for client ${client.id}:`, error);
    } catch (error) {
        console.error(`Failed to send connection-expired email for client ${client.id}:`, error);
    }
}
