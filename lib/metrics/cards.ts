import type { ComputedMetrics } from "@/lib/metrics/compute";

// Single source of truth for which KPI cards a surface shows and how each metric is labelled,
// judged and formatted. The report page, the report email and the dashboard stat row all render
// from these definitions so labels/directions can't drift between surfaces.
//
// The card set is derived from the data, not from a guess at the account's business model — see
// selectKpiCards below.

export type MetricCardKey =
    | "spend"
    | "roas"
    | "cpa"
    | "conversions"
    | "leads"
    | "cpl"
    | "ctr"
    | "cpc"
    | "cpm"
    | "reach"
    | "frequency"
    | "impressions";

/** Formatter kind — each renderer maps it to its own formatter (web React vs email string). */
export type MetricFormat = "currency" | "percent" | "multiplier" | "count" | "compact" | "decimal";

export interface MetricCardDef {
    label: string;
    betterWhen: "up" | "down" | "neutral";
    format: MetricFormat;
}

export const METRIC_CARD_DEFS: Record<MetricCardKey, MetricCardDef> = {
    spend: { label: "Spend", betterWhen: "neutral", format: "currency" },
    roas: { label: "ROAS", betterWhen: "up", format: "multiplier" },
    cpa: { label: "CPA", betterWhen: "down", format: "currency" },
    conversions: { label: "Conversions", betterWhen: "up", format: "count" },
    leads: { label: "Leads", betterWhen: "up", format: "count" },
    cpl: { label: "CPL", betterWhen: "down", format: "currency" },
    ctr: { label: "CTR", betterWhen: "up", format: "percent" },
    cpc: { label: "CPC", betterWhen: "down", format: "currency" },
    cpm: { label: "CPM", betterWhen: "down", format: "currency" },
    reach: { label: "Reach", betterWhen: "up", format: "compact" },
    // Avg times each person saw the ads. Higher = more repetition/fatigue risk, so lower is better.
    frequency: { label: "Frequency", betterWhen: "down", format: "decimal" },
    impressions: { label: "Impressions", betterWhen: "up", format: "compact" },
};

/** Card keys map 1:1 onto ComputedMetrics fields. */
export const metricValue = (m: ComputedMetrics, key: MetricCardKey): number | null => m[key];

/**
 * Reading order of the KPI grid. Money and outcomes first, delivery last — the same order on every
 * report, so a reader who knows one account's report can read another's without hunting.
 */
const CARD_ORDER: readonly MetricCardKey[] = [
    "spend",
    "roas",
    "conversions",
    "cpa",
    "leads",
    "cpl",
    "ctr",
    "cpc",
    "cpm",
    "impressions",
    "reach",
    "frequency",
];

/**
 * Counts are printed only when something was actually counted. A measured zero is honest data, but
 * "Leads 0" on a pure e-commerce account (or "Conversions 0" on an awareness one) is a slot spent
 * saying nothing — and it is exactly the case where the metric doesn't apply to the account.
 * Rates and costs need no such rule: they are already null when their denominator never happened.
 */
const HIDE_WHEN_ZERO: readonly MetricCardKey[] = ["conversions", "leads", "impressions", "reach"];

/**
 * The KPI cards a report shows: every metric this account measurably has, in {@link CARD_ORDER}.
 *
 * Deliberately NOT a guess at what the account is "for". An earlier version classified each account
 * as e-commerce / lead-gen / awareness from its data and printed a fixed six-card set per class,
 * which silently dropped real numbers — an account that also sells hid its ROAS because it happened
 * to produce more leads than purchases. A metric is shown when it exists and hidden when it doesn't,
 * which is a property of the data rather than an opinion about the client.
 *
 * Decided on current ?? previous so the card set doesn't flicker when the newest window is empty.
 * Never returns nothing: spend is always meaningful, even at zero.
 */
export function selectKpiCards(
    current?: ComputedMetrics | null,
    previous?: ComputedMetrics | null,
): readonly MetricCardKey[] {
    const m = current ?? previous;
    if (!m) return ["spend", "impressions", "ctr", "cpm", "reach", "frequency"];

    const cards = CARD_ORDER.filter((key) => {
        const value = m[key];
        if (value == null) return false;
        return !(value === 0 && HIDE_WHEN_ZERO.includes(key));
    });

    return cards.length > 0 ? cards : ["spend"];
}
