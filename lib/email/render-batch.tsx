import "server-only";

import { BatchEmail, type BatchEmailItem } from "@/components/email/batch-email";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { renderReportPdf } from "@/lib/email/render-report-pdf";
import type { Translator } from "@/lib/metrics/present";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import pLimit from "p-limit";

// A client with many ad accounts renders many PDFs on one request. Cap the concurrency so a big
// batch can't spike memory on a serverless instance; PDF rendering is CPU-bound anyway.
const limit = pLimit(4);

export interface BatchAttachment {
    filename: string;
    content: Buffer;
}

export interface RenderedBatchEmail {
    subject: string;
    html: string;
    attachments: BatchAttachment[];
    /** Ids of the reports actually covered by this render — what the caller should release. */
    reportIds: number[];
    client: { id: number; email: string; name: string };
}

/**
 * Renders a validated report batch into ONE email: a compact per-account summary body plus one PDF
 * attachment per approved report. Server-only — `lib/report/send-batch.ts` is the only caller.
 *
 * Covers the batch's *approved* reports only, so a report the admin excluded during validation is
 * neither summarised nor attached. Returns null when the batch doesn't exist or nothing in it is
 * renderable.
 */
export async function renderBatchEmail(batchId: number): Promise<RenderedBatchEmail | null> {
    const batch = await prisma.reportBatch.findUnique({
        where: { id: batchId },
        select: {
            client: { select: { id: true, email: true, name: true, locale: true } },
            reports: { where: { approved: true }, orderBy: { id: "asc" }, select: { id: true } },
        },
    });

    if (!batch || batch.reports.length === 0) return null;

    const locale = isLocale(batch.client.locale) ? batch.client.locale : DEFAULT_LOCALE;
    const tRaw = await getTranslations({ locale });
    const t: Translator = (key, values) => tRaw(key as never, values as never);

    const rendered = await Promise.all(
        batch.reports.map((r) =>
            limit(async () => {
                const pdf = await renderReportPdf(r.id, locale);
                return pdf ? { reportId: r.id, pdf } : null;
            }),
        ),
    );

    // A report with no snapshots can't be dated or attributed to an account — drop it rather than
    // attach a PDF with no numbers in it.
    const covered = rendered.filter((r): r is NonNullable<typeof r> => r !== null);
    if (covered.length === 0) return null;

    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";

    const items: BatchEmailItem[] = covered.map(({ reportId, pdf }) => {
        const s = pdf.summary;

        return {
            accountName: s.accountName,
            platformLabel: s.platformLabel,
            period: s.period,
            score: s.score,
            scoreLabel: s.scoreLabel,
            // The compact body leads with three of the six shared KPI columns.
            kpis: s.kpis.slice(0, 3),
            recommendationCount: s.recommendationCount,
            urgentCount: s.urgentCount,
            viewUrl:
                s.accountId && base ? `${base}/dashboard/reports/${reportId}?account=${s.accountId}` : null,
            pdfFilename: pdf.filename,
        };
    });

    // Overall span across every account in the batch, for the subject line and footer.
    const from = new Date(Math.min(...covered.map((r) => r.pdf.summary.from.getTime())));
    const to = new Date(Math.max(...covered.map((r) => r.pdf.summary.to.getTime())));
    const period = `${dateFormatRelative(from, { locale })} – ${dateFormatRelative(to, { locale })}`;
    const count = items.length;

    // Dynamic import: Next 16 / Turbopack blocks a *static* import of react-dom/server in the app graph.
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html =
        "<!DOCTYPE html>" +
        renderToStaticMarkup(
            <BatchEmail
                clientName={batch.client.name}
                period={period}
                items={items}
                dashboardUrl={base ? `${base}/dashboard` : null}
                t={t}
                locale={locale}
            />,
        );

    return {
        subject: t("email.batch.subject", { count, period }),
        html,
        attachments: covered.map((r) => ({ filename: r.pdf.filename, content: r.pdf.content })),
        reportIds: covered.map((r) => r.reportId),
        client: { id: batch.client.id, email: batch.client.email, name: batch.client.name },
    };
}
