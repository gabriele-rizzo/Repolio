"use server";

import type { AdAccount, PlatformConnection } from "@/generated/prisma/browser";
import type { SnapshotCreateManyInput } from "@/generated/prisma/models";
import { DAY_MS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/try-catch";
import { getTimeline } from "@/lib/zernio/ads";
import type { SnapshotData } from "@/lib/zernio/types";

export type AdAccountWithConnection = AdAccount & { connection: PlatformConnection };

// Re-pull this many trailing days each run to absorb late attribution corrections (Meta's default
// click window is 7 days). The first-ever pull backfills the account's whole history instead.
const TRAILING_DAYS = 7;
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

    // First-ever pull backfills history; later pulls only re-fetch the trailing attribution window.
    const existing = await prisma.snapshot.findFirst({
        where: { ad_account_id: adAccount.id },
        select: { id: true },
    });

    const now = Date.now();
    const backfillFloor = new Date(now - MAX_BACKFILL_DAYS * DAY_MS);
    const from = existing
        ? new Date(now - TRAILING_DAYS * DAY_MS)
        : adAccount.created_at > backfillFloor
          ? adAccount.created_at
          : backfillFloor;

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
