import type { Snapshot } from "@/generated/prisma/browser";
import { ScoreLabel } from "@/generated/prisma/enums";

type MetaAction = { action_type: string; value: string };

type MetaInsightsRow = {
    account_id: string;
    objective?: string;
    date_start: string;
    date_stop: string;
    spend: string;
    impressions: string;
    clicks: string;
    reach?: string;
    frequency?: string;
    actions?: MetaAction[];
    action_values?: MetaAction[];
};

type MetaSnapshotData = { data: MetaInsightsRow[] };

type CampaignType = "performance" | "awareness" | "consideration" | "unknown";

export interface ComputedMetrics {
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

const PERFORMANCE = new Set(["OUTCOME_SALES", "CONVERSIONS", "LEAD_GENERATION"]);
const AWARENESS = new Set(["OUTCOME_AWARENESS", "BRAND_AWARENESS", "REACH"]);
const CONSIDERATION = new Set(["OUTCOME_TRAFFIC", "TRAFFIC", "ENGAGEMENT"]);

const num = (v: string | null | undefined): number => {
    if (v == null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const sumAction = (rows: MetaAction[] | undefined, type: string): number => {
    if (!rows) return 0;
    return rows.filter((r) => r.action_type === type).reduce((acc, r) => acc + num(r.value), 0);
};

const classify = (objective: string): CampaignType => {
    const o = objective.toUpperCase();
    if (PERFORMANCE.has(o)) return "performance";
    if (AWARENESS.has(o)) return "awareness";
    if (CONSIDERATION.has(o)) return "consideration";
    return "unknown";
};

function dominantObjective(rows: MetaInsightsRow[]): string {
    const counts = new Map<string, number>();

    for (const row of rows) {
        const obj = row.objective ?? "unknown";
        counts.set(obj, (counts.get(obj) ?? 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

/**
 * Aggregates Meta snapshot data into account-level KPIs and a performance score.
 * Computed live from whatever snapshots fall in the requested window — no longer
 * stored on the report. Returns null when there's no data for the window.
 */
export function computeMetaMetrics(snapshots: Snapshot[]): ComputedMetrics | null {
    const rows: MetaInsightsRow[] = [];
    for (const s of snapshots) {
        const raw = s.data as unknown as MetaSnapshotData | null;
        if (raw && Array.isArray(raw.data)) rows.push(...raw.data);
    }

    if (rows.length === 0) return null;

    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let revenue = 0;
    let reachTotal: number | null = null;
    let frequencyRaw: number | null = null;

    for (const row of rows) {
        spend += num(row.spend);
        impressions += num(row.impressions);
        clicks += num(row.clicks);
        conversions += sumAction(row.actions, "purchase");
        revenue += sumAction(row.action_values, "purchase");
        if (row.reach != null) reachTotal = (reachTotal ?? 0) + num(row.reach);
        if (row.frequency != null) frequencyRaw = num(row.frequency);
    }

    const reach = reachTotal;
    const frequency = reach != null && reach > 0 ? impressions / reach : frequencyRaw;
    const revenueOut = revenue > 0 ? revenue : null;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const cpa = conversions > 0 ? spend / conversions : null;
    const cpc = clicks > 0 ? spend / clicks : null;
    const roas = revenueOut != null && spend > 0 ? revenueOut / spend : null;

    const type = classify(dominantObjective(rows));

    let performance_score: number;
    if (type === "performance") {
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
