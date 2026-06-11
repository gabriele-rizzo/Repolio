"use server";

import type { Client, PlatformConnection, Snapshot } from "@/generated/prisma/browser";
import { DAY_MS, REFRESH_THRESHOLD_DAYS } from "@/lib/constants";
import { renderConnectionExpiredEmail } from "@/lib/email/render-connection-expired";
import { PLATFORM_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { err, ok, sink } from "@/lib/try-catch";
import { listAccounts } from "@/lib/zernio/accounts";
import { fetchSnapshot } from "./fetch-snapshot";

export async function collectSnapshots(client: Client): Promise<Result<Snapshot[], string>> {
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
            disconnectedIds = await syncConnectionHealth(
                client,
                adAccounts.map((a) => a.connection),
            );
        } catch (error) {
            console.error(`Connection health check failed for client ${client.id}:`, error);
        }
    }

    // Pull only for healthy, Zernio-backed connections.
    const usable = adAccounts.filter(
        (a) => a.connection.zernio_account_id != null && !disconnectedIds.has(a.connection.id),
    );

    const results = await Promise.all(usable.map((a) => fetchSnapshot(a)));
    const [batches, errors] = sink(results);

    if (errors.length > 0) {
        errors.forEach((e) => console.error(`Snapshot fetch failed: ${e}`));

        if (batches.length === 0) {
            return err(`No successful snapshot fetch for client '${client.id}', but there were errors (check logs).`);
        }
    }

    const inputs = batches.flat();
    if (inputs.length === 0) return ok([]);

    // Per-day upsert so re-fetched trailing days overwrite (createMany/skipDuplicates can't update
    // an existing day). Keyed on the @@unique([start_date, ad_account_id]).
    try {
        const snapshots = await prisma.$transaction(
            inputs.map((input) =>
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
        );
        return ok(snapshots);
    } catch {
        return err(`Failed to upsert snapshots for client '${client.id}'`);
    }
}

/**
 * Reconciles each connection's status against Zernio's view. Returns the set of connection ids that
 * are currently disconnected (so the caller can skip pulling them). Flips PlatformConnection.status
 * in the DB and notifies the client once per disconnected connection.
 */
async function syncConnectionHealth(client: Client, connections: PlatformConnection[]): Promise<Set<number>> {
    const profileId = client.zernio_profile_id;
    const disconnectedConnectionIds = new Set<number>();
    if (!profileId) return disconnectedConnectionIds;

    const disconnected = await listAccounts(profileId, "disconnected");
    const disconnectedZernioIds = new Set(disconnected.map((a) => a._id));

    // Many ad accounts can share one connection — dedupe so we update/notify each once.
    const byId = new Map(connections.map((c) => [c.id, c]));

    for (const connection of byId.values()) {
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
async function notifyConnectionExpired(client: Client, connection: PlatformConnection): Promise<void> {
    const since = new Date(Date.now() - REFRESH_THRESHOLD_DAYS * DAY_MS);
    const recent = await prisma.notification.findFirst({
        where: { client_id: client.id, type: "CONNECTION_EXPIRED", created_at: { gte: since } },
        select: { id: true },
    });
    if (recent) return;

    const platformLabel = PLATFORM_META[connection.platform].label;
    const link = "/dashboard/account";

    try {
        await prisma.notification.create({
            data: {
                client_id: client.id,
                type: "CONNECTION_EXPIRED",
                title: `Reconnect your ${platformLabel} account`,
                body: `Your ${platformLabel} connection was lost, so new report data has paused. Reconnect to resume.`,
                link,
            },
        });
    } catch (error) {
        console.error(`Failed to create CONNECTION_EXPIRED notification for client ${client.id}:`, error);
    }

    try {
        const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
        const reconnectUrl = base ? `${base}${link}` : link;
        const email = renderConnectionExpiredEmail({ clientName: client.name, platformLabel, reconnectUrl });

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
