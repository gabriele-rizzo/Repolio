import "server-only";

import { DEFAULT_LOCALE, isLocale } from "@/i18n/request";
import { renderBatchEmail } from "@/lib/email/render-batch";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";

export interface SendBatchResult {
    /** How many reports were released and covered by the email. */
    sent: number;
    /** How many reports in the batch the admin excluded, and which stay hidden. */
    excluded: number;
}

/**
 * Delivers a validated report batch: ONE email to the client with a compact summary of every
 * approved report plus that report's full write-up as a PDF attachment.
 *
 * Order matters. Reports are released (`released_at`, the only gate on client visibility) and the
 * batch marked sent ONLY after Resend accepts the email, so a delivery failure leaves the batch
 * pending and re-validatable rather than silently publishing reports the client never got told
 * about. Already-sent batches are rejected outright, so a double click can't email a client twice.
 *
 * Throws with an admin-readable message on any failure — the caller is a server action that hands
 * the message straight back to the validation UI.
 */
export async function sendReportBatch(batchId: number): Promise<SendBatchResult> {
    const batch = await prisma.reportBatch.findUnique({
        where: { id: batchId },
        select: {
            id: true,
            sent_at: true,
            client: { select: { id: true, locale: true } },
            reports: { select: { id: true, approved: true } },
        },
    });

    if (!batch) throw new Error("That report batch no longer exists.");
    if (batch.sent_at) throw new Error("This batch has already been sent.");

    const excluded = batch.reports.filter((r) => !r.approved).length;

    const rendered = await renderBatchEmail(batchId);
    if (!rendered) {
        throw new Error(
            "Nothing to send — every report in this batch is either excluded or has no snapshots to report on.",
        );
    }

    // Lazy import so a missing/invalid RESEND_API_KEY surfaces here as a send failure rather than
    // crashing the module graph (matches how the rest of the app reaches Resend).
    const { resend } = await import("@/lib/resend");
    const { error } = await resend.emails.send({
        // Set RESEND_FROM to a verified-domain sender in production; the resend.dev fallback only
        // delivers to the Resend account owner.
        from: process.env.RESEND_FROM ?? "Repolio <team@gj-automate.com>",
        to: rendered.client.email,
        subject: rendered.subject,
        html: rendered.html,
        attachments: rendered.attachments.map((a) => ({ filename: a.filename, content: a.content })),
    });

    if (error) {
        console.error(`Resend rejected report batch ${batchId}:`, error);
        throw new Error(`The email could not be sent: ${error.message}`);
    }

    const now = new Date();
    await prisma.$transaction([
        prisma.report.updateMany({ where: { id: { in: rendered.reportIds } }, data: { released_at: now } }),
        prisma.reportBatch.update({ where: { id: batchId }, data: { sent_at: now } }),
    ]);

    // In-app notification: one per batch, matching the one email. Best-effort — the reports are
    // already delivered and visible, so a notification failure must not report the send as failed.
    try {
        const locale = isLocale(batch.client.locale) ? batch.client.locale : DEFAULT_LOCALE;
        const t = await getTranslations({ locale, namespace: "notifications.reportBatch" });
        const count = rendered.reportIds.length;

        await prisma.notification.create({
            data: {
                client_id: batch.client.id,
                type: "REPORT_READY",
                title: t("title", { count }),
                body: t("body", { count }),
                // A single report deep-links to itself; several land on Home, which lists every account.
                link: count === 1 ? `/dashboard/reports/${rendered.reportIds[0]}` : "/dashboard",
            },
        });
    } catch (error) {
        console.error(`Failed to create batch notification for batch ${batchId}:`, error);
    }

    return { sent: rendered.reportIds.length, excluded };
}
