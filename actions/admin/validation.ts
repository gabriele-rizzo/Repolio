"use server";

import { safeAction, type ActionResult } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { actionLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
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
