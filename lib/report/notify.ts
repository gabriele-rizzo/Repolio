import type { Client } from "@/generated/prisma/browser";
import { renderReportEmail } from "@/lib/email/render-report";
import { prisma } from "@/lib/prisma";

interface NotifyReportReadyArgs {
    reportId: number;
    adAccountId: number;
    adAccountName: string | null;
    client: Pick<Client, "id" | "email" | "name">;
}

/**
 * In-app notification + email that a report is ready. Every delivery failure is logged, never
 * thrown — notifying must not fail report generation. Shared by the poll cron (zero-activity
 * reports, delivered at submit time) and the collect cron (AI reports, delivered once the batch
 * result is written back).
 */
export async function notifyReportReady({ reportId, adAccountId, adAccountName, client }: NotifyReportReadyArgs): Promise<void> {
    try {
        await prisma.notification.create({
            data: {
                client_id: client.id,
                type: "REPORT_READY",
                title: `New report for ${adAccountName ?? "an ad account"}`,
                body: "Your latest performance report is ready to view.",
                link: `/dashboard/reports/${reportId}?account=${adAccountId}`,
            },
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }

    try {
        const email = await renderReportEmail(reportId, client.id);
        if (email) {
            // Lazy import so a missing/invalid RESEND_API_KEY can't crash report generation.
            const { resend } = await import("@/lib/resend");
            const { error } = await resend.emails.send({
                // Set RESEND_FROM to a verified-domain sender in production; the resend.dev fallback
                // only delivers to the Resend account owner.
                from: process.env.RESEND_FROM ?? "Repolio <team@gj-automate.com>",
                to: client.email,
                subject: email.subject,
                html: email.html,
            });
            if (error) console.error(`Resend rejected report email ${reportId}:`, error);
        }
    } catch (error) {
        console.error(`Failed to send report email for report ${reportId}:`, error);
    }
}
