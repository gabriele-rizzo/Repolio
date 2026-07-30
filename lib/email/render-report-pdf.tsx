import "server-only";

import type { Recommendation } from "@/components/report/recommendation-card";
import type { ScoreLabel } from "@/generated/prisma/browser";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/request";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { ReportPdf } from "@/lib/email/report-pdf";
import { metricColumns, type MetricColumn, type Translator } from "@/lib/metrics/present";
import { metricsForWindow } from "@/lib/metrics/window";
import { PLATFORM_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { buildReportDocument } from "@/lib/report/template/document";
import { resolveTemplate } from "@/lib/report/template/resolve";
import { getTranslations } from "next-intl/server";

export interface RenderedReportPdf {
    /** Attachment name, safe for mail clients and filesystems. */
    filename: string;
    content: Buffer;
    /** Everything the batch email's compact summary row needs, so it never re-derives the numbers. */
    summary: {
        accountId: number | null;
        accountName: string;
        platformLabel: string;
        period: string;
        from: Date;
        to: Date;
        score: number | null;
        scoreLabel: ScoreLabel | null;
        kpis: MetricColumn[];
        recommendationCount: number;
        urgentCount: number;
    };
}

/** e.g. "Cinemepic-DE_2026-07-01_2026-07-30.pdf" */
function pdfFilename(accountName: string, from: Date, to: Date): string {
    const slug =
        accountName
            .normalize("NFKD")
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/[\s_]+/g, "-")
            .slice(0, 48) || "report";

    return `${slug}_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.pdf`;
}

/**
 * Renders one report to PDF bytes, using the template that governs its ad account (account override ->
 * client default -> built-in preset), in the owning client's language, along with the summary figures
 * the batch email quotes for it.
 *
 * The single source of the PDF: the batch send path attaches exactly this, and the admin validation
 * preview serves exactly this — so what an admin approves is byte-for-byte what the client receives.
 * Ignores `released_at` (both callers are admin-gated or the send path itself).
 *
 * Returns null when the report doesn't exist, or has no snapshots to date and attribute it by.
 */
export async function renderReportPdf(reportId: number, forceLocale?: Locale): Promise<RenderedReportPdf | null> {
    const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: { snapshots: { orderBy: { start_date: "asc" }, select: { start_date: true, ad_account_id: true } } },
    });

    const first = report?.snapshots[0];
    if (!report || !first) return null;

    const account = await prisma.adAccount.findUnique({
        where: { id: first.ad_account_id },
        select: {
            id: true,
            name: true,
            connection: {
                select: {
                    platform: true,
                    client: { select: { id: true, name: true, company: true, locale: true } },
                },
            },
        },
    });

    const client = account?.connection.client;
    const stored = client?.locale;
    const locale = forceLocale ?? (isLocale(stored) ? stored : DEFAULT_LOCALE);
    const tRaw = await getTranslations({ locale });
    const t: Translator = (key, values) => tRaw(key as never, values as never);

    const from = first.start_date;
    const to = report.snapshots.at(-1)?.start_date ?? from;

    // Same KPIs the report page shows: live over the report's covered period, plus the prior window.
    const { current, previous } = account
        ? await metricsForWindow(account.id, from, to)
        : { current: null, previous: null };

    const accountName = account?.name ?? t("account.connections.unnamedAccount");
    const platformLabel = account ? PLATFORM_META[account.connection.platform].label : "";
    const period = `${dateFormatRelative(from)} – ${dateFormatRelative(to)}`;
    const recommendations = (report.recommendations ?? []) as unknown as Recommendation[];

    // The client's own layout, falling back to the built-in preset when they've never set one.
    const template = client ? await resolveTemplate(account?.id ?? null, client.id) : null;

    const doc = buildReportDocument({
        templateBody: template?.body,
        accountName,
        platformLabel,
        clientName: client?.name ?? "",
        company: client?.company ?? null,
        period,
        periodStart: dateFormatRelative(from),
        periodEnd: dateFormatRelative(to),
        days: report.snapshots.length,
        generatedOn: dateFormatRelative(report.created_at),
        current,
        previous,
        executiveSummary: report.executive_summary,
        recommendations,
        trendExplanation: report.trend_explanation,
        contextComment: report.context_comment,
        t,
        locale,
        // The PDF's built-in Helvetica cannot encode ▲ / ▼ — inline change placeholders must use +/-.
        deltaStyle: "sign",
    });

    // Dynamic import: react-pdf is only needed on the send/preview paths, so keep it out of the static
    // graph of everything that transitively imports this module.
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const content = await renderToBuffer(<ReportPdf doc={doc} />);

    return {
        filename: pdfFilename(accountName, from, to),
        content,
        summary: {
            accountId: account?.id ?? null,
            accountName,
            platformLabel,
            period,
            from,
            to,
            score: current?.performance_score ?? null,
            scoreLabel: current?.score_label ?? null,
            kpis: metricColumns(current, previous, t),
            recommendationCount: recommendations.length,
            urgentCount: recommendations.filter((r) => r.priority === "IMMEDIATE").length,
        },
    };
}
