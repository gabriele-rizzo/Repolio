import type { ComputedMetrics } from "@/lib/metrics/compute";
import type { MetricFormat } from "@/lib/metrics/cards";
import {
    deltaArrow,
    deltaSigned,
    metricDelta,
    metricFormatters,
    resolveCurrency,
    type BetterWhen,
} from "@/lib/metrics/present";
import { SECTION_BLOCKS } from "@/lib/report/template/types";

/**
 * The `{{ .variable }}` catalogue: every placeholder a client can put in a report template, and the
 * code that resolves them to display strings for one report.
 *
 * Values arrive pre-formatted (currency in the account's own currency, percentages, compact counts) so
 * the two renderers only ever concatenate strings — a metric can't be spelled differently in the PDF
 * than in the email. A metric with no value renders as an em dash rather than "null".
 */

/** One entry in the reference list the template editor shows. */
export interface VariableDoc {
    name: string;
    description: string;
    /** Rendered as a sample so the editor can show the shape without a real report. */
    example: string;
    /**
     * Set for entries that surround markup rather than stand in for a value: the editor wraps the
     * current selection instead of inserting `{{ .name }}`. Conditionals are the only such entry.
     */
    wrap?: { open: string; close: string };
}

interface MetricVar {
    name: string;
    key: keyof ComputedMetrics;
    format: MetricFormat;
    betterWhen: BetterWhen;
    description: string;
    example: string;
}

// Every numeric metric on ComputedMetrics that is meaningful in a client-facing document. Each also
// gets a `<name>Change` companion below (the period-over-period delta).
const METRIC_VARS: MetricVar[] = [
    { name: "spend", key: "spend", format: "currency", betterWhen: "neutral", description: "Total spend for the period", example: "€12,480.55" },
    { name: "revenue", key: "revenue", format: "currency", betterWhen: "up", description: "Purchase-attributed revenue", example: "€41,230.10" },
    { name: "roas", key: "roas", format: "multiplier", betterWhen: "up", description: "Return on ad spend", example: "3.30x" },
    { name: "cpa", key: "cpa", format: "currency", betterWhen: "down", description: "Cost per acquisition", example: "€30.29" },
    { name: "cpl", key: "cpl", format: "currency", betterWhen: "down", description: "Cost per lead", example: "€18.40" },
    { name: "cpc", key: "cpc", format: "currency", betterWhen: "down", description: "Cost per link click", example: "€0.63" },
    { name: "cpm", key: "cpm", format: "currency", betterWhen: "down", description: "Cost per 1,000 impressions", example: "€6.77" },
    { name: "ctr", key: "ctr", format: "percent", betterWhen: "up", description: "Click-through rate", example: "1.24%" },
    { name: "conversions", key: "conversions", format: "count", betterWhen: "up", description: "Purchases + leads", example: "412" },
    { name: "purchases", key: "purchases", format: "count", betterWhen: "up", description: "Purchase conversions", example: "412" },
    { name: "leads", key: "leads", format: "count", betterWhen: "up", description: "Lead conversions", example: "0" },
    { name: "impressions", key: "impressions", format: "compact", betterWhen: "up", description: "Impressions served", example: "1.8M" },
    { name: "clicks", key: "clicks", format: "compact", betterWhen: "up", description: "All clicks", example: "23.1K" },
    { name: "linkClicks", key: "linkClicks", format: "compact", betterWhen: "up", description: "Link clicks only", example: "19.9K" },
    { name: "reach", key: "reach", format: "compact", betterWhen: "up", description: "People reached", example: "640.2K" },
    { name: "frequency", key: "frequency", format: "decimal", betterWhen: "down", description: "Average impressions per person", example: "2.88" },
];

/** Non-metric placeholders: who and when the report is about. */
const CONTEXT_VARS: VariableDoc[] = [
    { name: "accountName", description: "The ad account's name", example: "Cinemepic — Meta Ads" },
    { name: "platform", description: "The ad platform's label", example: "Meta" },
    { name: "clientName", description: "The client's name", example: "Samuel" },
    { name: "company", description: "The client's company, if set", example: "Cinemepic" },
    { name: "period", description: "The full period covered", example: "01 July – 30 July" },
    { name: "periodStart", description: "First day covered", example: "01 July" },
    { name: "periodEnd", description: "Last day covered", example: "30 July" },
    { name: "days", description: "Number of days covered", example: "30" },
    { name: "currency", description: "The account's currency code", example: "EUR" },
    { name: "performanceScore", description: "The 0–100 performance score", example: "78" },
    { name: "scoreLabel", description: "The score's band", example: "Strong" },
    { name: "generatedOn", description: "The date the report was generated", example: "30 July" },
    { name: "reportUrl", description: "Link to this report in the dashboard", example: "https://…/dashboard/reports/1" },
];

/** Placeholders that must sit alone on their own line, each expanding to a designed section. */
const SECTION_DOCS: Record<(typeof SECTION_BLOCKS)[number], string> = {
    scoreCard: "The performance score card",
    metricsTable: "The KPI grid with period-over-period changes",
    recommendations: "The AI-written recommendation cards",
    trendExplanation: "The AI-written trend explanation",
    contextComment: "The context note on the report, if any",
};

/**
 * What a metric with no value prints. Exported because `{{ #if .x }}` tests against it: "resolved to the
 * em dash" IS the definition of "this report has nothing to show here".
 */
export const EM_DASH = "—";

/** Every scalar placeholder name, for validating a template. */
export const SCALAR_VARIABLE_NAMES: string[] = [
    ...CONTEXT_VARS.map((v) => v.name),
    ...METRIC_VARS.map((v) => v.name),
    ...METRIC_VARS.map((v) => `${v.name}Change`),
];

/** The grouped reference list rendered in the template editor. */
export const VARIABLE_REFERENCE: { group: string; variables: VariableDoc[] }[] = [
    { group: "Sections", variables: SECTION_BLOCKS.map((name) => ({ name, description: SECTION_DOCS[name], example: "" })) },
    { group: "Report", variables: CONTEXT_VARS },
    { group: "Metrics", variables: METRIC_VARS.map(({ name, description, example }) => ({ name, description, example })) },
    {
        group: "Metric changes",
        variables: METRIC_VARS.map(({ name, description }) => ({
            name: `${name}Change`,
            description: `${description} — change vs the previous period`,
            example: "▲ 22%",
        })),
    },
    {
        group: "Conditions",
        variables: [
            {
                name: "#if .roas",
                description:
                    "Keeps what's inside only when the value exists. Drops it when the metric is n/a for this account, or when there's no previous period to compare against — so a card never reads \"—\". Swap .roas for any value above.",
                example: "",
                wrap: { open: "{{ #if .roas }}", close: "{{ /if }}" },
            },
        ],
    },
];

/**
 * How `{{ .xChange }}` values are spelled. The PDF must use "sign" — its built-in Helvetica has no
 * ▲ / ▼ in WinAnsi encoding, and embedding them renders visible mojibake ("² 23%"). Each renderer
 * builds its own document, so each picks the form its own KPI grid already uses.
 */
export type DeltaStyle = "arrow" | "sign";

export interface VariableContext {
    accountName: string;
    platformLabel: string;
    clientName: string;
    company: string | null;
    period: string;
    reportUrl: string;
    periodStart: string;
    periodEnd: string;
    days: number;
    generatedOn: string;
    current: ComputedMetrics | null;
    previous: ComputedMetrics | null;
    /** Localised score band, resolved by the caller (which owns the translator). */
    scoreLabel: string;
    deltaStyle: DeltaStyle;
    /** BCP-47 tag for number formatting, so a German report reads "€3.460,45". */
    numberLocale: string;
}

/**
 * Resolves every scalar placeholder for one report into display strings.
 *
 * Missing metrics become an em dash, and a change with nothing comparable to measure against does too
 * — a template that prints `{{ .roasChange }}` for a lead-gen account with no purchases must read as
 * "no data", not as a zero or a crash.
 */
export function buildVariables(ctx: VariableContext): Record<string, string> {
    const formats = metricFormatters(resolveCurrency(ctx.current, ctx.previous), ctx.numberLocale);

    const vars: Record<string, string> = {
        accountName: ctx.accountName,
        platform: ctx.platformLabel,
        clientName: ctx.clientName,
        company: ctx.company ?? EM_DASH,
        period: ctx.period,
        reportUrl: ctx.reportUrl,
        periodStart: ctx.periodStart,
        periodEnd: ctx.periodEnd,
        days: String(ctx.days),
        currency: resolveCurrency(ctx.current, ctx.previous),
        performanceScore: ctx.current?.performance_score != null ? String(ctx.current.performance_score) : EM_DASH,
        scoreLabel: ctx.scoreLabel,
        generatedOn: ctx.generatedOn,
    };

    for (const metric of METRIC_VARS) {
        const value = ctx.current?.[metric.key];
        vars[metric.name] = typeof value === "number" ? formats[metric.format](value) : EM_DASH;

        const delta = metricDelta(
            typeof value === "number" ? value : null,
            typeof ctx.previous?.[metric.key] === "number" ? (ctx.previous[metric.key] as number) : null,
            metric.betterWhen,
        );
        vars[`${metric.name}Change`] = delta
            ? ctx.deltaStyle === "sign"
                ? deltaSigned(delta)
                : deltaArrow(delta)
            : EM_DASH;
    }

    return vars;
}
