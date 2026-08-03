"use server";

import { safeAction, type ActionResult } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getAnthropic } from "@/lib/ai/anthropic";
import { buildReportParams } from "@/lib/ai/generate-report";
import { runCollect } from "@/lib/cron/collect";
import { computeMetrics } from "@/lib/metrics/compute";
import { prisma } from "@/lib/prisma";
import { actionLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { reportAiStatus } from "@/lib/report/ai-status";
import { sendReportBatch } from "@/lib/report/send-batch";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/**
 * Includes or excludes one report from its pending batch. Excluding leaves the report unreleased, so
 * it is never emailed and never appears in the client's dashboard.
 *
 * Only reports in a batch that hasn't been sent can be toggled — once the email is out, the decision
 * is history.
 */
export async function setReportApproval(reportId: number, approved: boolean): Promise<ActionResult> {
    return safeAction(async () => {
        // Server actions are public endpoints — gate independently of the admin layout UI.
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        const { count } = await prisma.report.updateMany({
            where: { id: reportId, report_batch: { sent_at: null } },
            data: { approved },
        });

        if (count === 0) throw new Error("That report is not in a pending batch — its batch may already be sent.");

        revalidatePath("/admin/validation");
    });
}

export type ExcludeEmptyResult = { error: string } | { excluded: number };

/**
 * Excludes every report in a pending batch whose AI section is empty, in one call.
 *
 * A monthly batch can carry dozens of accounts, and the dead ones — a period with no activity never
 * calls the model — are exactly the reports that shouldn't reach the client. Doing that one row at a
 * time is the same decision fifty times over.
 *
 * Emptiness is decided HERE, from the stored rows, not from what the client sends: the caller passes
 * a batch id and nothing else, so a stale screen can't talk this into dropping a report that has
 * since finished generating. `ai_pending` reports are left alone for the same reason — their text is
 * still in flight.
 */
export async function excludeEmptyReports(batchId: number): Promise<ExcludeEmptyResult> {
    let excluded = 0;

    const result = await safeAction(async () => {
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        const batch = await prisma.reportBatch.findUnique({
            where: { id: batchId },
            select: {
                sent_at: true,
                reports: {
                    where: { approved: true },
                    select: { id: true, ai_pending: true, trend_explanation: true, recommendations: true },
                },
            },
        });

        if (!batch) throw new Error("That batch no longer exists.");
        if (batch.sent_at) throw new Error("That batch has already been sent — its reports can't be changed.");

        const empty = batch.reports.filter((report) => reportAiStatus(report) === "EMPTY").map((report) => report.id);

        if (empty.length === 0) throw new Error("Every report here already has an AI section.");

        const { count } = await prisma.report.updateMany({
            where: { id: { in: empty } },
            data: { approved: false },
        });

        excluded = count;
        revalidatePath("/admin/validation");
    });

    return result?.error ? result : { excluded };
}

/**
 * Validates a batch: sends the client ONE email covering every approved report in it (each attached
 * as a PDF) and releases those reports into the client's dashboard.
 *
 * Rate-limited per IP like the other admin action that sends mail — this one can attach a dozen PDFs,
 * so an accidental double-submit is worth blocking even behind the admin login.
 */
export async function validateAndSendBatch(batchId: number): Promise<ActionResult> {
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(actionLimiter, `send-batch:${ip}`);
    if (!success) return { error: `Too many requests. Please try again in ${retryAfterSeconds}s.` };

    return safeAction(async () => {
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        await sendReportBatch(batchId);

        revalidatePath("/admin/validation");
        revalidatePath("/dashboard");
    });
}

export type RegenerateResult = { error: string } | { submitted: number; skipped: number };

/**
 * Rewrites the AI section of every report in a pending batch, against the SAME data.
 *
 * Nothing about the underlying numbers changes: the reports keep their rows, their snapshots and
 * their periods, and the KPIs were never stored in the first place (they are recomputed live from
 * snapshots on every surface). Only the model's output is replaced. That is what makes this the tool
 * for "the write-up is wrong" — edit the account's context or its template, regenerate, read it again.
 *
 * Submitted through the Anthropic Batches API, exactly like the poll cron: half the price of live
 * calls, and — the reason it matters here — it returns immediately instead of holding a serverless
 * function open for a minute per report. The reports are marked `ai_pending` ("Generating" on this
 * screen) and their new text is written back by {@link runCollect}, which the cron runs hourly and
 * {@link collectAiResults} runs on demand.
 *
 * Existing text is deliberately left in place until the new text lands, so a failed regeneration
 * degrades to the previous report rather than to an empty one.
 */
export async function regenerateBatch(batchId: number): Promise<RegenerateResult> {
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(actionLimiter, `regenerate-batch:${ip}`);
    if (!success) return { error: `Too many requests. Please try again in ${retryAfterSeconds}s.` };

    let submitted = 0;
    let skipped = 0;

    const result = await safeAction(async () => {
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        const batch = await prisma.reportBatch.findUnique({
            where: { id: batchId },
            select: {
                sent_at: true,
                reports: { orderBy: { id: "asc" }, select: { id: true, ai_pending: true, snapshots: true } },
            },
        });

        if (!batch) throw new Error("That batch no longer exists.");
        // A sent batch is history: its reports are already released and emailed to the client.
        if (batch.sent_at) throw new Error("That batch has already been sent — its reports can't be regenerated.");
        if (batch.reports.length === 0) throw new Error("That batch has no reports to regenerate.");

        const requests: { custom_id: string; params: Awaited<ReturnType<typeof buildReportParams>> }[] = [];

        for (const report of batch.reports) {
            // Already in flight — resubmitting would orphan the request we're waiting on.
            if (report.ai_pending) {
                skipped += 1;
                continue;
            }

            // Same rule the poll cron applies: a period with no spend, no impressions and no
            // conversions has nothing to narrate, and paying tokens to say so is waste.
            const metrics = computeMetrics(report.snapshots);
            if (!metrics || (metrics.spend === 0 && metrics.impressions === 0 && metrics.conversions === 0)) {
                skipped += 1;
                continue;
            }

            try {
                requests.push({ custom_id: String(report.id), params: await buildReportParams(report.id) });
            } catch (error) {
                // One unbuildable report (no snapshots, say) must not sink the rest of the batch.
                console.error(`Failed to build report params for report ${report.id}:`, error);
                skipped += 1;
            }
        }

        if (requests.length === 0) {
            throw new Error(
                skipped > 0
                    ? "Nothing to regenerate — every report here is already generating or has no activity to write about."
                    : "Nothing to regenerate.",
            );
        }

        const anthropicBatch = await getAnthropic().messages.batches.create({ requests });

        await prisma.report.updateMany({
            where: { id: { in: requests.map((r) => Number(r.custom_id)) } },
            data: { ai_pending: true, batch_id: anthropicBatch.id },
        });

        submitted = requests.length;
        revalidatePath("/admin/validation");
    });

    return result?.error ? result : { submitted, skipped };
}

export type CollectResultAction = { error: string } | { applied: number; stillPending: number };

/**
 * Pulls in any finished AI results now, instead of waiting for the hourly collect cron.
 *
 * The same pass the cron runs — an admin who has just regenerated a batch wants to read the result in
 * a minute or two, which is roughly how long a small Anthropic batch takes to finish.
 */
export async function collectAiResults(): Promise<CollectResultAction> {
    let applied = 0;
    let stillPending = 0;

    const result = await safeAction(async () => {
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        const collected = await runCollect();
        applied = collected.applied;
        stillPending = collected.stillPending;

        revalidatePath("/admin/validation");
    });

    return result?.error ? result : { applied, stillPending };
}
