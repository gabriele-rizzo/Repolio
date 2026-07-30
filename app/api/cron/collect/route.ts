import { getAnthropic } from "@/lib/ai/anthropic";
import { applyGeneratedReport } from "@/lib/ai/generate-report";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";
import pLimit from "p-limit";

// Collect phase of report generation. The poll cron submits report AI sections to the Anthropic
// Batches API and marks those reports `ai_pending`. This route retrieves the batches that have
// finished, writes the results back and clears `ai_pending`. Reports whose batch is still processing
// are left pending and picked up on a later run. Runs hourly — batches usually finish within an hour
// (max 24h).
//
// This route does NOT notify or email anyone. A finished report is only complete, not delivered: it
// waits in its client's ReportBatch until an admin validates it at /admin/validation, which is what
// releases it and sends the client's single batched email.

const limit = pLimit(10);

// Retrieving + writing back every finished batch overruns the 10s default budget; 60s is the
// Hobby ceiling. Keep in sync with the other cron routes.
export const maxDuration = 60;

// Vercel Cron invokes via GET.
export async function GET(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (!isAuthorizedCron(request)) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const pending = await prisma.report.findMany({
        where: { ai_pending: true, batch_id: { not: null } },
        select: { id: true, batch_id: true },
    });

    if (pending.length === 0) return new NextResponse(null, { status: 204 });

    // Group pending reports by the batch they were submitted in.
    const byBatch = new Map<string, typeof pending>();
    for (const report of pending) {
        if (!report.batch_id) continue;
        const bucket = byBatch.get(report.batch_id);
        if (bucket) bucket.push(report);
        else byBatch.set(report.batch_id, [report]);
    }

    const anthropic = getAnthropic();

    for (const [batchId, reports] of byBatch) {
        let status: string;
        try {
            const batch = await anthropic.messages.batches.retrieve(batchId);
            status = batch.processing_status;
        } catch (error) {
            console.error(`Failed to retrieve batch ${batchId}:`, error);
            continue;
        }

        // Not finished yet — leave these reports pending for a later run.
        if (status !== "ended") continue;

        const stillPending = new Set(reports.map((r) => r.id));

        let results;
        try {
            results = await anthropic.messages.batches.results(batchId);
        } catch (error) {
            console.error(`Failed to fetch results for batch ${batchId}:`, error);
            continue;
        }

        const tasks: Promise<void>[] = [];
        for await (const result of results) {
            const reportId = Number(result.custom_id);
            if (!stillPending.has(reportId)) continue; // already finalized on an earlier run

            tasks.push(
                limit(async () => {
                    // Write the AI section on success; on any failure the report stays empty (its KPIs
                    // still render live). Either way, clear ai_pending so we don't reprocess it.
                    if (result.result.type === "succeeded") {
                        try {
                            await applyGeneratedReport(reportId, result.result.message);
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

    return new NextResponse(null);
}
