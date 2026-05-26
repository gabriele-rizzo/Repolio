import type { Snapshot } from "@/generated/prisma/browser";
import { ScoreLabel } from "@/generated/prisma/enums";
import { err, ok } from "@/lib/try-catch";

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

type Anomaly = {
    severity: "LOW" | "MEDIUM" | "HIGH";
    code: string;
    campaign_external_id: string | null;
    message: string;
};

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

export const metaAdapter: Repolio.Adapter = (snapshots: Snapshot[]) => {
    const rows: MetaInsightsRow[] = [];
    for (const s of snapshots) {
        const raw = s.data as unknown as MetaSnapshotData | null;
        if (raw && Array.isArray(raw.data)) rows.push(...raw.data);
    }

    if (rows.length === 0) {
        return err(`No Meta insights data across ${snapshots.length} snapshot(s)`);
    }

    // --- A: CORE KPIs — sum across rows (account-level totals) ---
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
    // Prefer derived frequency from totals; fall back to the raw row value.
    const frequency = reach != null && reach > 0 ? impressions / reach : frequencyRaw;
    const revenueOut = revenue > 0 ? revenue : null;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const cpa = conversions > 0 ? spend / conversions : null;
    const cpc = clicks > 0 ? spend / clicks : null;
    const roas = revenueOut != null && spend > 0 ? revenueOut / spend : null;

    // --- D: LOGIC — anomalies (account-level only; per-campaign needs richer data) ---
    const type = classify(rows[0].objective ?? "");
    const anomalies: Anomaly[] = [];
    if (frequency != null && frequency > 5) {
        anomalies.push({
            severity: "MEDIUM",
            code: "HIGH_FREQUENCY",
            campaign_external_id: null,
            message: `Frequency ${frequency.toFixed(2)} above 5 — audience saturation risk.`,
        });
    }
    if (type === "performance" && impressions > 0 && ctr < 0.5) {
        anomalies.push({
            severity: "LOW",
            code: "LOW_CTR",
            campaign_external_id: null,
            message: `CTR ${ctr.toFixed(2)}% below 0.5%.`,
        });
    }

    // --- D: LOGIC — Performance Score (v1, no benchmarks yet) ---
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

    return ok({
        // A: Core KPIs
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

        // B: Time series — requires additional API calls not yet in the snapshot
        daily_kpis: [],

        // C: Campaign breakdown — requires level=campaign insights not yet in the snapshot
        campaigns: [],

        // D: Logic
        performance_score,
        score_label,
        anomalies,

        // E: AI — filled by the downstream Claude step
        executive_summary: "",
        recommendations: [],
        trend_explanation: "",

        // F: Inputs — set by agency via Supabase, joined in a later step
        target_cpa: null,
        target_roas: null,
        context_comment: null,
    });
};
