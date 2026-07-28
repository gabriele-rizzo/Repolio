import "server-only";

import { getReport } from "@/actions/report/get-report";
import { ReportEmail } from "@/components/email/report-email";
import type { Recommendation } from "@/components/report/recommendation-card";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { metricsForWindow } from "@/lib/metrics/window";
import { PLATFORM_META } from "@/lib/platform";
import type { Client } from "@/generated/prisma/browser";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/request";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";

export interface RenderedReportEmail {
    subject: string;
    html: string;
}

/**
 * Renders a report to a self-contained HTML string for emailing. Server-only and intentionally not a
 * client-callable action: it's meant to run from trusted server code (the cron poll, which already knows
 * the owning client_id, or a future authed "email me this report" action). Returns null if the report
 * doesn't exist or isn't owned by `clientId`. Does NOT send anything — only renders.
 */
export async function renderReportEmail(reportId: number, clientId: Client["id"]): Promise<RenderedReportEmail | null> {
    const fetched = await getReport(String(reportId), clientId);
    if (!fetched) return null;

    const { report, account, from, to } = fetched;

    // Render in the recipient client's saved language.
    const clientRow = await prisma.client.findUnique({ where: { id: clientId }, select: { locale: true } });
    const locale = isLocale(clientRow?.locale) ? clientRow.locale : DEFAULT_LOCALE;
    const tRaw = await getTranslations({ locale });
    const t = (key: string, values?: Record<string, string | number>) => tRaw(key as never, values as never);

    // Same KPIs the report page shows: live over the report's covered period, plus the prior window.
    const { current, previous } = account
        ? await metricsForWindow(account.id, from, to)
        : { current: null, previous: null };

    const accountName = account?.name ?? t("account.connections.unnamedAccount");
    const platformLabel = account ? PLATFORM_META[account.connection.platform].label : "";
    const period = `${dateFormatRelative(from)} – ${dateFormatRelative(to)}`;

    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
    const viewUrl = account && base ? `${base}/dashboard/reports/${report.id}?account=${account.id}` : null;

    // Dynamic import: Next 16 / Turbopack blocks a *static* import of react-dom/server in the app graph.
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html =
        "<!DOCTYPE html>" +
        renderToStaticMarkup(
            <ReportEmail
                accountName={accountName}
                platformLabel={platformLabel}
                period={period}
                current={current}
                previous={previous}
                executiveSummary={report.executive_summary}
                recommendations={(report.recommendations ?? []) as unknown as Recommendation[]}
                trendExplanation={report.trend_explanation}
                contextComment={report.context_comment}
                viewUrl={viewUrl}
                t={t}
                locale={locale}
            />,
        );

    return { subject: t("email.subject", { account: accountName, period }), html };
}
