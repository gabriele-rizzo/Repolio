import type { Snapshot } from "@/generated/prisma/browser";
import { ScoreLabel } from "@/generated/prisma/enums";
import { extractRowFacts } from "@/lib/metrics/extract";
import type { SnapshotData } from "@/lib/zernio/types";

/**
 * Which click series drives ctr/cpc. "link" matches Ads Manager's CTR (link) — the number agencies
 * compare against; windows whose rows never break out link_click fall back to all clicks
 * automatically. Flip to "all" to compute on raw clicks instead.
 */
const CLICK_BASIS: "all" | "link" = "link";

/**
 * Null-vs-0 policy (what consumers may rely on):
 * - spend / impressions / clicks / purchases / leads / conversions: 0 means measured zero
 *   (Meta omits action types with no events, so an absent map reads as "none happened").
 * - linkClicks: null when no row in the window broke out link_click (unmeasured, not zero).
 * - revenue: never 0 — an unmeasured purchase value collapses to null so ROAS can't render 0.00x.
 * - ctr / cpm / cpa / cpl / cpc / roas: null whenever the denominator (or revenue) is missing;
 *   0 only as a truthfully computed rate (e.g. free conversions at 0 spend).
 */
export interface ComputedMetrics {
    currency: string;
    spend: number;
    revenue: number | null;
    impressions: number;
    /** All clicks (Zernio scalar). Link clicks live in {@link ComputedMetrics.linkClicks}. */
    clicks: number;
    linkClicks: number | null;
    /** Purchases + leads — the product's conversion definition (breakdown alongside). */
    conversions: number;
    purchases: number;
    leads: number;
    reach: number | null;
    frequency: number | null;
    ctr: number | null;
    cpm: number | null;
    cpa: number | null;
    cpl: number | null;
    cpc: number | null;
    roas: number | null;
    performance_score: number;
    score_label: ScoreLabel;
}

const num = (v: number | string | null | undefined): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

const clampScore = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Aggregates Zernio daily timeline rows (stored one per Snapshot) into account-level KPIs and a
 * performance score, recomputed live from whatever snapshots fall in the requested window. The
 * output shape is consumed unchanged by the report page, the AI prompt and the report email.
 * Conversion/revenue facts come from the raw action maps via lib/metrics/extract.ts — never from
 * Zernio's derived scalars (see lib/zernio/types.ts). Returns null when there's no usable data.
 */
export function computeMetrics(snapshots: Snapshot[]): ComputedMetrics | null {
    const rows: SnapshotData[] = [];
    for (const s of snapshots) {
        const d = s.data as unknown as SnapshotData | null;
        // Guard against any non-Zernio-shaped rows (e.g. pre-cutover snapshots not yet cleared).
        if (d && typeof d === "object" && "spend" in d) rows.push(d);
    }

    if (rows.length === 0) return null;

    // Timeline rows don't carry currency; it's stamped in at fetch time from /v1/ads/accounts.
    const currency = rows.find((r) => r.currency)?.currency ?? "EUR";

    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let reachTotal = 0;
    let purchases = 0;
    let leads = 0;
    let revenue: number | null = null;
    let linkClicksTotal: number | null = null;

    for (const r of rows) {
        spend += num(r.spend);
        impressions += num(r.impressions);
        clicks += num(r.clicks);
        reachTotal += num(r.reach);

        const facts = extractRowFacts(r);
        purchases += facts.purchases;
        leads += facts.leads;
        if (facts.revenue != null) revenue = (revenue ?? 0) + facts.revenue;
        if (facts.linkClicks != null) linkClicksTotal = (linkClicksTotal ?? 0) + facts.linkClicks;
    }

    const conversions = purchases + leads;
    const linkClicks = linkClicksTotal;

    // Daily rows give per-day reach; summing over-counts unique users reached across days, so
    // period reach/frequency are approximate (Zernio exposes no period-level reach). This is an
    // intended behaviour change vs the old single-row Meta snapshot.
    const reach = reachTotal > 0 ? reachTotal : null;
    const frequency = reach != null && reach > 0 ? impressions / reach : null;
    const revenueOut = revenue != null && revenue > 0 ? revenue : null;

    // Recompute rate metrics from summed totals (don't average Zernio's per-day derived values).
    const clickBasis = CLICK_BASIS === "link" && linkClicks != null ? linkClicks : clicks;
    const ctr = impressions > 0 ? (clickBasis / impressions) * 100 : null;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
    const cpa = conversions > 0 ? spend / conversions : null;
    const cpl = leads > 0 ? spend / leads : null;
    const cpc = clickBasis > 0 ? spend / clickBasis : null;
    const roas = revenueOut != null && spend > 0 ? revenueOut / spend : null;

    // Timeline rows have no campaign objective, so performance vs awareness can't be classified.
    // E-commerce accounts (measured purchase revenue) score on the ROAS curve. Lead-gen accounts
    // (conversions, no revenue) have no ROI benchmark until CPL targets exist, so they anchor at 55
    // and move within the MODERATE band on engagement signals. Nothing measurable stays neutral 50.
    const ctrBoost = ctr != null && ctr >= 1.5 ? 10 : 0;
    const freqPenalty = frequency != null && frequency > 3.5 ? 15 : 0;

    let performance_score: number;
    if (revenueOut != null) {
        const roasScore = roas != null ? Math.min(100, (roas / 5) * 100) : 0;
        performance_score = clampScore(roasScore + ctrBoost - freqPenalty);
    } else if (conversions > 0) {
        performance_score = clampScore(55 + ctrBoost - freqPenalty);
    } else {
        performance_score = 50;
    }

    const score_label =
        performance_score >= 70
            ? ScoreLabel.STRONG
            : performance_score >= 40
              ? ScoreLabel.MODERATE
              : ScoreLabel.NEEDS_IMPROVEMENT;

    return {
        currency,
        spend,
        revenue: revenueOut,
        impressions,
        clicks,
        linkClicks,
        conversions,
        purchases,
        leads,
        reach,
        frequency,
        ctr,
        cpm,
        cpa,
        cpl,
        cpc,
        roas,
        performance_score,
        score_label,
    };
}
