"use server";

import type { AdAccount, PlatformConnection } from "@/generated/prisma/browser";
import type { SnapshotCreateManyInput } from "@/generated/prisma/models";
import { DAY_MS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/try-catch";
import { getTimeline } from "@/lib/zernio/ads";
import type { SnapshotData } from "@/lib/zernio/types";

export type AdAccountWithConnection = AdAccount & { connection: PlatformConnection };

// Trailing attribution window to re-absorb late corrections (Meta's default click window is 7 days).
// Re-pulling this whole window every day is mostly redundant, so we only do it on the weekly
// reconcile day; other days pull just from the last recorded day forward. The first-ever pull
// backfills the account's whole history instead. Tradeoff: attribution corrections older than a day
// land on the next reconcile day rather than immediately — fine for a 7-day window reconciled weekly.
const TRAILING_DAYS = 7;
const RECONCILE_WEEKDAY = 1; // Monday (UTC getUTCDay()): the one day we re-pull the full window.
const MAX_BACKFILL_DAYS = 730; // Zernio's timeline range cap.

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Pulls daily ad metrics for one ad account from Zernio's timeline and shapes them into one
 * Snapshot row per calendar day (stamped with the account currency). Returns [] for an account
 * with no activity in the window — normal right after connect while Zernio's initial sync lags.
 */
export async function fetchSnapshot(
    adAccount: AdAccountWithConnection,
): Promise<Result<SnapshotCreateManyInput[], string>> {
    const { connection } = adAccount;
    if (!connection.zernio_account_id) {
        return err(`Connection ${connection.id} has no Zernio account id; reconnect required.`);
    }

    // First-ever pull backfills history; later pulls fetch from the last recorded day forward, except
    // on the weekly reconcile day, when we re-pull the full trailing window to absorb late attribution.
    const latest = await prisma.snapshot.findFirst({
        where: { ad_account_id: adAccount.id },
        orderBy: { start_date: "desc" },
        select: { start_date: true },
    });

    const now = Date.now();
    const backfillFloor = new Date(now - MAX_BACKFILL_DAYS * DAY_MS);

    let from: Date;
    if (!latest) {
        from = adAccount.created_at > backfillFloor ? adAccount.created_at : backfillFloor;
    } else if (new Date(now).getUTCDay() === RECONCILE_WEEKDAY) {
        from = new Date(now - TRAILING_DAYS * DAY_MS);
    } else {
        from = latest.start_date;
    }

    let rows;
    try {
        rows = await getTimeline(connection.zernio_account_id, adAccount.external_id, ymd(from), ymd(new Date(now)));
    } catch (error) {
        return err(`Zernio timeline fetch failed for ad account ${adAccount.id}: ${String(error)}`);
    }

    const currency = adAccount.currency ?? "EUR";
    const inputs: SnapshotCreateManyInput[] = rows.map((row) => {
        const data: SnapshotData = { ...row, currency };
        return {
            ad_account_id: adAccount.id,
            platform: connection.platform,
            // Pin the account-local calendar day to UTC midnight so the @@unique([start_date,
            // ad_account_id]) key is stable regardless of server timezone.
            start_date: new Date(`${row.date}T00:00:00.000Z`),
            data: data as unknown as SnapshotCreateManyInput["data"],
        };
    });

    return ok(inputs);
}
