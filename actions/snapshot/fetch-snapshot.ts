"use server";

import type { AdAccount, PlatformConnection } from "@/generated/prisma/browser";
import type { SnapshotCreateManyInput } from "@/generated/prisma/models";
import { DAY_MS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { logSyncError } from "@/lib/sync-error";
import { err, ok } from "@/lib/try-catch";
import { getTimeline } from "@/lib/zernio/ads";
import type { SnapshotData } from "@/lib/zernio/types";

export type AdAccountWithConnection = AdAccount & { connection: PlatformConnection };

// Every run re-pulls a trailing window and upserts, so partial days (mid-day pulls, the current
// day) and Meta's attribution restatements (~72h lag) get overwritten daily; the weekly reconcile
// widens the window to Meta's full 7-day click-attribution span. The first-ever pull backfills the
// account's whole history instead.
const REPULL_DAYS = 3; // daily trailing re-pull (covers Meta's ~72h attribution restatements)
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
        // Recorded at the source: only here are the account and client ids both in hand — the
        // error strings that bubble up through sink/settle lose that structure.
        const message = `Connection ${connection.id} has no Zernio account id; reconnect required.`;
        await logSyncError({ stage: "fetch_snapshot", clientId: connection.client_id, adAccountId: adAccount.id, message });
        return err(message);
    }

    // First-ever pull backfills history; later pulls re-pull the trailing window (3 days, 7 on the
    // weekly reconcile day). Taking the earlier of (last recorded day, window floor) keeps gaps
    // covered — missed runs, re-enabled accounts — even when the gap spans a reconcile Monday.
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
    } else {
        const days = new Date(now).getUTCDay() === RECONCILE_WEEKDAY ? TRAILING_DAYS : REPULL_DAYS;
        const windowFloor = new Date(now - days * DAY_MS);
        from = latest.start_date < windowFloor ? latest.start_date : windowFloor;
        if (from < backfillFloor) from = backfillFloor;
    }

    console.log(`[snapshots] account=${adAccount.id} window=${ymd(from)}..${ymd(new Date(now))}`);

    let rows;
    try {
        rows = await getTimeline(connection.zernio_account_id, adAccount.external_id, ymd(from), ymd(new Date(now)));
    } catch (error) {
        const message = `Zernio timeline fetch failed for ad account ${adAccount.id}: ${String(error)}`;
        await logSyncError({ stage: "fetch_snapshot", clientId: connection.client_id, adAccountId: adAccount.id, message });
        return err(message);
    }

    const currency = adAccount.currency ?? "EUR";
    const inputs: SnapshotCreateManyInput[] = rows.map((row) => {
        // engagement is an excluded vanity metric — never persisted (see SnapshotData).
        const kept = { ...row };
        delete kept.engagement;
        const data: SnapshotData = { ...kept, currency };
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
