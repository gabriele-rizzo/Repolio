import "server-only";

import { ReportEmail } from "@/components/email/report-email";
import type { Recommendation } from "@/components/report/recommendation-card";
import type { Client } from "@/generated/prisma/browser";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/request";
import { dateFormatRelative } from "@/lib/date/format-relative";
import type { Translator } from "@/lib/metrics/present";
import { metricsForWindow } from "@/lib/metrics/window";
import { PLATFORM_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { fetchReport } from "@/lib/report/fetch-report";
import { buildReportDocument } from "@/lib/report/template/document";
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
 * Renders a report to a self-contained HTML string, using the client's report template.
 *
 * Server-only and intentionally not a client-callable action: it's meant to run from trusted server
 * code. Returns null if the report doesn't exist or isn't owned by `clientId`.
 *
 * This is the same document the PDF attachment renders, in HTML — it backs the client's in-page
 * "Download PDF" button (printed by the browser) and the template editor's live preview. Does NOT send
 * anything.
 */
export async function renderReportEmail(
    reportId: number,
    clientId: Client["id"],
    { allowUnreleased = false, templateBody }: RenderReportEmailOptions = {},
): Promise<RenderedReportEmail | null> {
    const fetched = await fetchReport(String(reportId), { clientId, allowUnreleased });
    if (!fetched) return null;

    const { report, account, from, to } = fetched;

    // Render in the recipient client's saved language.
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
    const viewUrl = account && base ? `${base}/dashboard/reports/${report.id}?account=${account.id}` : null;

    // An explicit body (the editor previewing unsaved edits) wins over the stored template.
    const resolved = templateBody != null ? { body: templateBody } : await resolveTemplate(account?.id ?? null, clientId);

    const doc = buildReportDocument({
        templateBody: resolved.body,
        accountName,
        platformLabel,
        clientName: clientRow?.name ?? "",
        company: clientRow?.company ?? null,
        period,
        periodStart: dateFormatRelative(from),
        periodEnd: dateFormatRelative(to),
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

    // Dynamic import: Next 16 / Turbopack blocks a *static* import of react-dom/server in the app graph.
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = "<!DOCTYPE html>" + renderToStaticMarkup(<ReportEmail doc={doc} viewUrl={viewUrl} />);

    return { subject: t("email.subject", { account: accountName, period }), html };
}
