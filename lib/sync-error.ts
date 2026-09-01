import { DAY_MS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 30;

export interface SyncErrorEntry {
    /**
     * Pipeline stage. Free-form, but keep to the existing vocabulary so /admin/health groups cleanly:
     *
     * snapshots  "fetch_snapshot" | "upsert_snapshots" | "refresh_ad_accounts" | "health_check" |
     *            "collect_snapshots" | "snapshots_budget_exhausted"
     * recovery   "repull_range"   (admin-triggered re-pull of a damaged window, /admin/recovery)
     * reports    "poll_due_clients" | "poll_backfill" | "poll_build_params" | "batch_submit" |
     *            "poll_budget_exhausted"
     * ai         "collect_retrieve_batch" | "collect_fetch_results" | "collect_apply_result" |
     *            "collect_result_not_succeeded" | "ai_output_repaired"
     * delivery   "send_batch_rejected" | "send_batch_notification" | "validation_build_params" |
     *            "pdf_template_fallback"
     *
     * The two *_budget_exhausted stages are not failures of a unit of work — they record that a run
     * hit its wall-clock budget and deliberately deferred the rest (see lib/cron/budget.ts).
     */
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
