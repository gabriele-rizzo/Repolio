import type { ComputedMetrics } from "@/lib/metrics/compute";

// Single source of truth for which KPI cards a surface shows and how each metric is labelled,
// judged and formatted. The report page, the report email and the dashboard stat row all render
// from these definitions so labels/directions can't drift between surfaces.

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

export type AccountFocus = "ecom" | "leadgen" | "mixed" | "none";

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
 * Classifies what the account is optimizing for from what it measurably produced, so surfaces can
 * lead with the metrics that matter (a lead-gen account must never headline an "n/a" ROAS).
 * Decided on current ?? previous so the card set stays stable across window flips.
 */
export function accountFocus(current?: ComputedMetrics | null, previous?: ComputedMetrics | null): AccountFocus {
    const m = current ?? previous;
    if (!m) return "none";

    const hasPurchases = m.purchases > 0 || m.revenue != null;
    const hasLeads = m.leads > 0;
    if (hasPurchases && hasLeads) return "mixed";
    if (hasLeads) return "leadgen";
    if (hasPurchases) return "ecom";
    return "none";
}

// Always exactly 6 cards: the report grid (xl:grid-cols-6) and the email's 3x2 table both assume it.
const CARD_SETS: Record<AccountFocus, readonly MetricCardKey[]> = {
    ecom: ["spend", "roas", "cpa", "conversions", "ctr", "reach"],
    leadgen: ["spend", "leads", "cpl", "ctr", "cpc", "reach"],
    mixed: ["spend", "roas", "conversions", "cpa", "cpl", "ctr"],
    // Awareness/no-conversion accounts: frequency (ad fatigue) is the actionable signal here, so it
    // takes CPC's slot — there are no conversions for a click-cost to speak to.
    none: ["spend", "impressions", "ctr", "cpm", "reach", "frequency"],
};

export function selectKpiCards(focus: AccountFocus): readonly MetricCardKey[] {
    return CARD_SETS[focus];
}
