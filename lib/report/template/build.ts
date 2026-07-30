import type { Recommendation } from "@/components/report/recommendation-card";
import type { ComputedMetrics } from "@/lib/metrics/compute";
import { metricColumns, type Translator } from "@/lib/metrics/present";
import { renderTemplate, wrapDocument } from "@/lib/report/template/render";
import { buildVariables, type DeltaStyle } from "@/lib/report/template/variables";

/**
 * Assembles one report's final markup from its template.
 *
 * Both deliverables come from here: the standalone HTML document, and the PDF (which maps this same
 * markup onto react-pdf primitives). One function, so the two can only differ in how a renderer
 * interprets the markup — never in content.
 */
export interface BuildReportHtmlInput {
    templateBody: string | null | undefined;
    accountName: string;
    platformLabel: string;
    clientName: string;
    company: string | null;
    period: string;
    periodStart: string;
    periodEnd: string;
    reportUrl: string;
    days: number;
    generatedOn: string;
    current: ComputedMetrics | null;
    previous: ComputedMetrics | null;
    executiveSummary: string;
    recommendations: Recommendation[];
    trendExplanation: string;
    contextComment: string | null;
    t: Translator;
    locale: string;
    /**
     * How `{{ .xChange }}` placeholders are spelled. Default "arrow" (▲ / ▼) suits HTML; the PDF passes
     * "sign", because its built-in font cannot encode those glyphs.
     */
    deltaStyle?: DeltaStyle;
}

export interface BuiltReport {
    /** Body markup — what the PDF renderer consumes. */
    body: string;
    /** The same markup as a standalone HTML document. */
    document: string;
}

export function buildReportHtml(input: BuildReportHtmlInput): BuiltReport {
    const scoreLabel = input.current?.score_label ?? null;

    const body = renderTemplate({
        body: input.templateBody,
        variables: buildVariables({
            accountName: input.accountName,
            platformLabel: input.platformLabel,
            clientName: input.clientName,
            company: input.company,
            period: input.period,
            reportUrl: input.reportUrl,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            days: input.days,
            generatedOn: input.generatedOn,
            current: input.current,
            previous: input.previous,
            scoreLabel: scoreLabel ? input.t(`score.${scoreLabel}`) : "—",
            deltaStyle: input.deltaStyle ?? "arrow",
        }),
        sections: {
            score: input.current?.performance_score ?? null,
            scoreLabel,
            kpis: metricColumns(input.current, input.previous, input.t),
            executiveSummary: input.executiveSummary,
            recommendations: input.recommendations,
            trendExplanation: input.trendExplanation,
            contextComment: input.contextComment,
            t: input.t,
            deltaStyle: input.deltaStyle ?? "arrow",
        },
    });

    return {
        body,
        document: wrapDocument(body, {
            title: `${input.accountName} — ${input.t("email.performanceReport")}`,
            locale: input.locale,
        }),
    };
}
