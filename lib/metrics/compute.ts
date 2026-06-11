import type { Snapshot } from "@/generated/prisma/browser";
import { ScoreLabel } from "@/generated/prisma/enums";
import type { SnapshotData } from "@/lib/zernio/types";

export interface ComputedMetrics {
    currency: string;
    spend: number;
    revenue: number | null;
    impressions: number;
    clicks: number;
    conversions: number;
    reach: number | null;
    frequency: number | null;
    ctr: number;
    cpm: number;
    cpa: number | null;
    cpc: number | null;
    roas: number | null;
    performance_score: number;
    score_label: ScoreLabel;
}

const num = (v: number | string | null | undefined): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Aggregates Zernio daily timeline rows (stored one per Snapshot) into account-level KPIs and a
 * performance score, recomputed live from whatever snapshots fall in the requested window. The
 * output shape is consumed unchanged by the report page, the AI prompt and the report email.
 * Returns null when there's no usable data.
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
    let conversions = 0;
    let revenue = 0;
    let reachTotal = 0;

    for (const r of rows) {
        spend += num(r.spend);
        impressions += num(r.impressions);
        clicks += num(r.clicks);
        conversions += num(r.conversions);
        revenue += num(r.purchaseValue);
        reachTotal += num(r.reach);
    }

    // Daily rows give per-day reach; summing over-counts unique users reached across days, so
    // period reach/frequency are approximate (Zernio exposes no period-level reach). This is an
    // intended behaviour change vs the old single-row Meta snapshot.
    const reach = reachTotal > 0 ? reachTotal : null;
    const frequency = reach != null && reach > 0 ? impressions / reach : null;
    const revenueOut = revenue > 0 ? revenue : null;

    // Recompute rate metrics from summed totals (don't average Zernio's per-day derived values).
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const cpa = conversions > 0 ? spend / conversions : null;
    const cpc = clicks > 0 ? spend / clicks : null;
    const roas = revenueOut != null && spend > 0 ? revenueOut / spend : null;

    // Timeline rows have no campaign objective, so we can't classify performance vs awareness as
    // before. Proxy: treat as a conversion account if it produced any conversions or purchase
    // revenue and score it on ROAS; otherwise neutral 50.
    const isConversion = conversions > 0 || revenueOut != null;
    let performance_score: number;
    if (isConversion) {
        const roasScore = roas != null ? Math.min(100, (roas / 5) * 100) : 0;
        const ctrBoost = ctr >= 1.5 ? 10 : 0;
        const freqPenalty = frequency != null && frequency > 3.5 ? 15 : 0;
        performance_score = Math.max(0, Math.min(100, Math.round(roasScore + ctrBoost - freqPenalty)));
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
        conversions,
        reach,
        frequency,
        ctr,
        cpm,
        cpa,
        cpc,
        roas,
        performance_score,
        score_label,
    };
}
