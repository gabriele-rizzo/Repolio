"use server";

import type { SnapshotCreateManyInput } from "@/generated/prisma/models";
import { MAX_BACKFILL_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { logSyncError } from "@/lib/sync-error";
import { err, ok } from "@/lib/try-catch";
import { getTimeline } from "@/lib/zernio/ads";
import type { SnapshotData } from "@/lib/zernio/types";
import type { AdAccountWithConnection } from "./fetch-snapshot";

// Recovery re-pull: re-fetch ONE ad account over an EXPLICIT day range and upsert what comes back.
//
// This is deliberately not a parameter on fetchSnapshot, because it differs from the daily pull in
// the one way that matters:
//
//   IT DOES NOT ZERO-FILL. fetchSnapshot writes an explicit all-zero row for every day in its
//   trailing window that a successful fetch didn't return, which is what makes a missing row mean
//   "never fetched" (lib/snapshot/zero-fill.ts). During the Zernio billing lapse of Aug 2026 that
//   rule turned against us: Zernio answered 200 with rows: [] for accounts it had stopped serving,
//   so zero-fill froze fake zeros across the outage — and those rows advanced the newest recorded
//   day, so the next day's trailing window started AFTER them and never looked back. A recovery
//   re-pull that zero-filled would simply re-freeze the damage it was sent to heal.
//
// So: days Zernio returns are upserted (overwriting a fake zero with the truth); days it does not
// return are LEFT EXACTLY AS THEY ARE. That makes the operation non-destructive and repeatable —
// worst case it changes nothing, and it can never turn real stored data into a hole.

/** Upper bound on one re-pull request. Zernio serves a range per call; this is a serverless request. */
const MAX_RANGE_DAYS = MAX_BACKFILL_DAYS;

export interface RepullOutcome {
    /** Days Zernio returned data for within the requested range. */
    fetched: number;
    /** Rows actually written (fetched days that upserted cleanly). */
    upserted: number;
    /** Days in the range Zernio still returns nothing for — left untouched, not zeroed. */
    unresolved: number;
}

const dayMs = (date: string): number => Date.parse(`${date}T00:00:00.000Z`);
const isDay = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dayMs(value));

/**
 * Re-pulls `[from, to]` (inclusive, UTC day strings) for one ad account.
 *
 * Returns a Result rather than throwing: the admin recovery screen re-pulls several accounts in one
 * click and one dead account must not abort the rest, matching the rest of the pipeline.
 */
export async function repullRange(
    adAccount: AdAccountWithConnection,
    from: string,
    to: string,
): Promise<Result<RepullOutcome, string>> {
    const { connection } = adAccount;

    if (!isDay(from) || !isDay(to)) return err(`Invalid range ${from}..${to}: expected YYYY-MM-DD.`);
    if (dayMs(to) < dayMs(from)) return err(`Invalid range ${from}..${to}: end precedes start.`);

    const days = Math.round((dayMs(to) - dayMs(from)) / 86_400_000) + 1;
    if (days > MAX_RANGE_DAYS) return err(`Range ${from}..${to} is ${days} days; the maximum is ${MAX_RANGE_DAYS}.`);

    if (!connection.zernio_account_id) {
        return err(`Connection ${connection.id} has no Zernio account id; reconnect required.`);
    }

    let rows;
    try {
        rows = await getTimeline(connection.zernio_account_id, adAccount.external_id, from, to);
    } catch (error) {
        const message = `Recovery re-pull failed for ad account ${adAccount.id} (${from}..${to}): ${String(error)}`;
        await logSyncError({ stage: "repull_range", clientId: connection.client_id, adAccountId: adAccount.id, message });
        return err(message);
    }

    const currency = adAccount.currency ?? "EUR";
    const inputs: SnapshotCreateManyInput[] = rows
        // Zernio is asked for a range but the response is trusted only inside it — a row outside the
        // requested window would silently rewrite a day the admin did not agree to touch.
        .filter((row) => dayMs(row.date) >= dayMs(from) && dayMs(row.date) <= dayMs(to))
        .map((row) => {
            // engagement is an excluded vanity metric — never persisted (see SnapshotData).
            const kept = { ...row };
            delete kept.engagement;
            const data = { ...kept, currency } as SnapshotData;

            return {
                ad_account_id: adAccount.id,
                platform: connection.platform,
                start_date: new Date(`${data.date}T00:00:00.000Z`),
                data: data as unknown as SnapshotCreateManyInput["data"],
            };
        });

    console.log(`[recovery] account=${adAccount.id} window=${from}..${to} rows=${inputs.length}/${days}`);

    // Sequential, and each upsert its own autocommitted statement — NOT wrapped in $transaction, for
    // the same reason as the daily pull (P2028 on a long backfill, see collect-snapshots.ts): partial
    // progress must stick so a re-pull too big for one request just shrinks the damage every attempt.
    let upserted = 0;
    let firstError: unknown = null;

    for (const input of inputs) {
        try {
            await prisma.snapshot.upsert({
                where: {
                    start_date_ad_account_id: { start_date: input.start_date, ad_account_id: input.ad_account_id },
                },
                create: input,
                update: { data: input.data, platform: input.platform },
            });
            upserted += 1;
        } catch (error) {
            firstError ??= error;
        }
    }

    if (upserted < inputs.length) {
        const message = `Recovery re-pull wrote ${upserted}/${inputs.length} rows for ad account ${adAccount.id} (${from}..${to}). First error: ${String(firstError)}`;
        await logSyncError({ stage: "repull_range", clientId: connection.client_id, adAccountId: adAccount.id, message });
        return err(message);
    }

    // Deliberately does NOT stamp AdAccount.last_synced_at. That column answers "is this account's
    // sync still advancing" for /admin/health's stale list; healing a historical window says nothing
    // about whether today's pull works, and stamping it here would silence that alarm on exactly the
    // accounts most likely to still be broken.
    return ok({ fetched: inputs.length, upserted, unresolved: days - inputs.length });
}
