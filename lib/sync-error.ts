import { DAY_MS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 30;

export interface SyncErrorEntry {
    /** Pipeline stage, e.g. "fetch_snapshot" | "upsert_snapshots" | "refresh_ad_accounts" | "health_check" | "poll_backfill" | "batch_submit". */
    stage: string;
    message: string;
    clientId?: number;
    adAccountId?: number;
}

/**
 * Persists a pipeline failure for later inspection (SELECT * FROM "SyncError" ORDER BY created_at
 * DESC). Never throws: observability must not fail the pipeline, and if the code deploys before
 * the sync_errors migration is applied this degrades to console logging instead of crashing.
 */
export async function logSyncError(entry: SyncErrorEntry): Promise<void> {
    try {
        await prisma.syncError.create({
            data: {
                stage: entry.stage,
                message: entry.message,
                client_id: entry.clientId,
                ad_account_id: entry.adAccountId,
            },
        });
    } catch (error) {
        console.error(`Failed to record SyncError [${entry.stage}] ${entry.message}:`, error);
    }
}

/** Retention sweep, run at the start of the daily cron. Same never-throw contract. */
export async function pruneSyncErrors(maxAgeDays = RETENTION_DAYS): Promise<void> {
    try {
        await prisma.syncError.deleteMany({
            where: { created_at: { lt: new Date(Date.now() - maxAgeDays * DAY_MS) } },
        });
    } catch (error) {
        console.error("Failed to prune SyncError rows:", error);
    }
}
