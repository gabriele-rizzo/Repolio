import "server-only";

import type { Recommendation } from "@/components/report/recommendation-card";
import type { Client } from "@/generated/prisma/browser";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { dateFormatRelative } from "@/lib/date/format-relative";
import type { Translator } from "@/lib/metrics/present";
import { metricsForWindow } from "@/lib/metrics/window";
import { PLATFORM_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { fetchReport } from "@/lib/report/fetch-report";
import { buildReportHtml } from "@/lib/report/template/build";
import { resolveTemplate } from "@/lib/report/template/resolve";
import { getTranslations } from "next-intl/server";

export interface RenderedReportEmail {
    subject: string;
    html: string;
}

export interface RenderReportEmailOptions {
    /** Include a report the client can't see yet. Admin/preview paths only. */
    allowUnreleased?: boolean;
    /** Override the stored template — used by the editor's live preview. */
    templateBody?: string;
}

/**
 * Renders a report to a standalone HTML document from the client's template.
 *
 * Server-only and intentionally not a client-callable action: it's meant to run from trusted server
 * code. Returns null if the report doesn't exist or isn't owned by `clientId`.
 *
 * The markup here is the same markup the PDF attachment is built from — it backs the in-page
 * "Download PDF" button (printed by the browser) and the template editor's preview. Client-authored
 * HTML is sanitized inside `renderTemplate` before it reaches this output, which matters because this
 * string is served as text/html from our own origin.
 */
export async function renderReportEmail(
    reportId: number,
    clientId: Client["id"],
    { allowUnreleased = false, templateBody }: RenderReportEmailOptions = {},
): Promise<RenderedReportEmail | null> {
    const fetched = await fetchReport(String(reportId), { clientId, allowUnreleased });
    if (!fetched) return null;

    const { report, account, from, to } = fetched;

    const clientRow = await prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true, company: true, locale: true },
    });
    const locale = isLocale(clientRow?.locale) ? clientRow.locale : DEFAULT_LOCALE;
    const tRaw = await getTranslations({ locale });
    const t: Translator = (key, values) => tRaw(key as never, values as never);

    // Same KPIs the report page shows: live over the report's covered period, plus the prior window.
    const { current, previous } = account
        ? await metricsForWindow(account.id, from, to)
        : { current: null, previous: null };

    const accountName = account?.name ?? t("account.connections.unnamedAccount");
    const platformLabel = account ? PLATFORM_META[account.connection.platform].label : "";
    const period = `${dateFormatRelative(from)} – ${dateFormatRelative(to)}`;

    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
    const reportUrl = account && base ? `${base}/dashboard/reports/${report.id}?account=${account.id}` : "";

    // An explicit body (the editor previewing unsaved edits) wins over the stored template.
    const resolved = templateBody != null ? { body: templateBody } : await resolveTemplate(account?.id ?? null, clientId);

    const { document } = buildReportHtml({
        templateBody: resolved.body,
        accountName,
        platformLabel,
        clientName: clientRow?.name ?? "",
        company: clientRow?.company ?? null,
        period,
        periodStart: dateFormatRelative(from),
        periodEnd: dateFormatRelative(to),
        reportUrl,
        days: report.snapshots.length,
        generatedOn: dateFormatRelative(report.created_at),
        current,
        previous,
        executiveSummary: report.executive_summary,
        recommendations: (report.recommendations ?? []) as unknown as Recommendation[],
        trendExplanation: report.trend_explanation,
        contextComment: report.context_comment,
        t,
        locale,
    });

    return { subject: t("email.subject", { account: accountName, period }), html: document };
}
