import "server-only";

import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { renderReportEmail } from "@/lib/email/render-report";
import type { Translator } from "@/lib/metrics/present";
import { prisma } from "@/lib/prisma";
import { buildReportHtml } from "@/lib/report/template/build";
import { RELEASED_REPORT } from "@/lib/report/visibility";
import { getTranslations } from "next-intl/server";

/**
 * Renders a template to preview HTML for the editor.
 *
 * Prefers a real report — the same renderer, the same data, so what you see is what will ship. Falls
 * back to sample figures when the account has no report yet, because a brand-new client must still be
 * able to see what their template does before their first report exists.
 */
export interface TemplatePreviewOptions {
    clientId: number;
    /** Preview against this account's data. Null previews the client's newest report on any account. */
    adAccountId: number | null;
    /** The (possibly unsaved) template body being edited. */
    body: string;
    /** Admin previews may use reports the client can't see yet. */
    allowUnreleased?: boolean;
}

export interface TemplatePreview {
    html: string;
    /** Whether the numbers are real or illustrative, so the UI can say so. */
    basis: "report" | "sample";
}

export async function renderTemplatePreview({
    clientId,
    adAccountId,
    body,
    allowUnreleased = false,
}: TemplatePreviewOptions): Promise<TemplatePreview> {
    const report = await prisma.report.findFirst({
        where: {
            snapshots: {
                some: {
                    ad_account: {
                        connection: { client_id: clientId },
                        ...(adAccountId == null ? {} : { id: adAccountId }),
                    },
                },
            },
            ...(allowUnreleased ? {} : RELEASED_REPORT),
        },
        orderBy: { created_at: "desc" },
        select: { id: true },
    });

    if (report) {
        const rendered = await renderReportEmail(report.id, clientId, { allowUnreleased, templateBody: body });
        if (rendered) return { html: rendered.html, basis: "report" };
    }

    return { html: await renderSamplePreview(clientId, body), basis: "sample" };
}

/**
 * Preview built from illustrative figures, for a client with no reports yet. Deliberately round numbers
 * rather than anything that could be mistaken for the account's real performance.
 */
async function renderSamplePreview(clientId: number, body: string): Promise<string> {
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true, company: true, locale: true },
    });

    const locale = isLocale(client?.locale) ? client.locale : DEFAULT_LOCALE;
    const tRaw = await getTranslations({ locale });
    const t: Translator = (key, values) => tRaw(key as never, values as never);

    const current = {
        currency: "EUR",
        spend: 10000,
        revenue: 35000,
        impressions: 1500000,
        clicks: 20000,
        linkClicks: 17500,
        conversions: 350,
        purchases: 350,
        leads: 0,
        reach: 500000,
        frequency: 3,
        ctr: 1.2,
        cpm: 6.67,
        cpa: 28.57,
        cpl: null,
        cpc: 0.57,
        roas: 3.5,
        performance_score: 74,
        score_label: "STRONG" as const,
        score_components: [],
        score_confidence: 0.8,
    };

    const { document } = buildReportHtml({
        templateBody: body,
        accountName: t("account.connections.unnamedAccount"),
        platformLabel: "Meta",
        clientName: client?.name ?? "",
        company: client?.company ?? null,
        period: "01 – 30",
        periodStart: "01",
        periodEnd: "30",
        reportUrl: "",
        days: 30,
        generatedOn: "30",
        current,
        previous: { ...current, spend: 8500, roas: 3.1, cpa: 32.4, conversions: 262, ctr: 1.35 },
        recommendations: [
            {
                priority: "IMMEDIATE",
                category: "BUDGET",
                title: "Sample recommendation",
                body: "Your real reports list the model's prioritised recommendations here, each with its own justification.",
            },
        ],
        trendExplanation: "Sample text standing in for the AI-written trend explanation.",
        contextComment: "Sample context note.",
        t,
        locale,
    });

    return document;
}
