import { getAnthropic } from "@/lib/ai/anthropic";
import { applyGeneratedReport } from "@/lib/ai/generate-report";
import { prisma } from "@/lib/prisma";
import pLimit from "p-limit";

// Collect phase of report generation. The poll cron (and the admin's "Regenerate" action) submit
// report AI sections to the Anthropic Batches API and mark those reports `ai_pending`. This retrieves
// the batches that have finished, writes the results back and clears `ai_pending`. Reports whose
// batch is still processing are left pending and picked up on a later run.
//
// Nothing here notifies or emails anyone. A finished report is only complete, not delivered: it waits
// in its client's ReportBatch until an admin validates it at /admin/validation.
//
// Extracted from the route so it can run both on the cron schedule (/api/cron/collect) and on demand
// from the validation screen, where an admin who just regenerated a batch shouldn't have to wait for
// the next scheduled run to see the result.

const limit = pLimit(10);

export interface CollectResult {
    /** Reports that were awaiting a result when this pass started. */
    pending: number;
    /** Reports whose AI section was written back on this pass. */
    applied: number;
    /** Reports still waiting on a batch that hasn't finished processing. */
    stillPending: number;
}

export async function runCollect(): Promise<CollectResult> {
    const pending = await prisma.report.findMany({
        where: { ai_pending: true, batch_id: { not: null } },
        select: { id: true, batch_id: true },
    });

    if (pending.length === 0) return { pending: 0, applied: 0, stillPending: 0 };

    // Group pending reports by the batch they were submitted in.
    const byBatch = new Map<string, typeof pending>();
    for (const report of pending) {
        if (!report.batch_id) continue;
        const bucket = byBatch.get(report.batch_id);
        if (bucket) bucket.push(report);
        else byBatch.set(report.batch_id, [report]);
    }

    let applied = 0;
    let stillPending = 0;

    for (const [batchId, reports] of byBatch) {
        let status: string;
        try {
            const batch = await getAnthropic().messages.batches.retrieve(batchId);
            status = batch.processing_status;
        } catch (error) {
            console.error(`Failed to retrieve batch ${batchId}:`, error);
            stillPending += reports.length;
            continue;
        }

        // Not finished yet — leave these reports pending for a later run.
        if (status !== "ended") {
            stillPending += reports.length;
            continue;
        }

        const awaiting = new Set(reports.map((r) => r.id));

        let results;
        try {
            results = await getAnthropic().messages.batches.results(batchId);
        } catch (error) {
            console.error(`Failed to fetch results for batch ${batchId}:`, error);
            stillPending += reports.length;
            continue;
        }

        const tasks: Promise<void>[] = [];
        for await (const result of results) {
            const reportId = Number(result.custom_id);
            if (!awaiting.has(reportId)) continue; // already finalized, or resubmitted into a newer batch

            tasks.push(
                limit(async () => {
                    // Write the AI section on success; on any failure the report keeps whatever it had
                    // (its KPIs render live regardless). Either way, clear ai_pending so we don't
                    // reprocess it — a resubmission is the admin's call, not an automatic retry.
                    if (result.result.type === "succeeded") {
                        try {
                            await applyGeneratedReport(reportId, result.result.message);
                            applied += 1;
                        } catch (error) {
                            console.error(`Failed to apply batch result for report ${reportId}:`, error);
                        }
                    } else {
                        console.error(`Batch result for report ${reportId} was ${result.result.type}`);
                    }

                    await prisma.report.update({ where: { id: reportId }, data: { ai_pending: false } });
                }),
            );
        }

        await Promise.all(tasks);
    }

    return { pending: pending.length, applied, stillPending };
}
