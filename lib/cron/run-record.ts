import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Run bookkeeping for the cron routes. Companion to lib/sync-error.ts, and the same contract: this
// is observability, so it must never be the reason a run fails, and it must degrade to console
// logging if the code deploys before the CronRun migration is applied.
//
// The split of responsibility: SyncError says which account or stage failed; CronRun says whether the
// invocation reached the end at all. Neither is inferable from the other, and only the second one
// catches a maxDuration kill — because a kill produces no error to record.

export type CronJob = "daily" | "snapshots" | "poll";

export interface PhaseCounts {
    /** Units of work the run found. */
    considered: number;
    /** Units that completed successfully. */
    processed: number;
    /** Units that were attempted and failed. */
    failed: number;
    /** Units never started because the wall-clock budget ran out. */
    skipped: number;
}

export const emptyCounts = (): PhaseCounts => ({ considered: 0, processed: 0, failed: 0, skipped: 0 });

/**
 * Opens a run row and returns the finisher.
 *
 * The row is written on START, not at the end, precisely so that a run killed at `maxDuration` leaves
 * a row behind with `finished_at` still NULL — the one signal a kill cannot erase. Writing only on
 * completion would record every outcome except the one worth alerting on.
 *
 * Returns a no-op finisher when the row could not be opened, so callers never branch on it.
 */
export async function startCronRun(job: CronJob) {
    const startedAt = Date.now();

    let id: number | null = null;
    try {
        const row = await prisma.cronRun.create({ data: { job }, select: { id: true } });
        id = row.id;
    } catch (error) {
        console.error(`Failed to open CronRun row for '${job}':`, error);
    }

    return async function finish(counts: PhaseCounts, detail?: Record<string, unknown>): Promise<void> {
        const durationMs = Date.now() - startedAt;

        // Always log, whether or not the row exists: the log line is the fallback diagnosis when the
        // migration hasn't landed, and it's what makes a run legible in the Vercel log stream.
        console.log(
            `[cron:${job}] done in ${durationMs}ms considered=${counts.considered} ok=${counts.processed} ` +
                `failed=${counts.failed} skipped=${counts.skipped}` +
                (counts.skipped > 0 ? " — RAN OUT OF WALL CLOCK, tail deferred to the next run" : ""),
        );

        if (id == null) return;

        try {
            await prisma.cronRun.update({
                where: { id },
                data: {
                    finished_at: new Date(),
                    duration_ms: durationMs,
                    ...counts,
                    detail: detail as Prisma.InputJsonValue | undefined,
                },
            });
        } catch (error) {
            console.error(`Failed to close CronRun row ${id} for '${job}':`, error);
        }
    };
}
