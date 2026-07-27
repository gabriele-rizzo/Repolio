import { ScoreLabel } from "@/generated/prisma/enums";

/**
 * Performance score.
 *
 * The old score was three constants in disguise: ROAS-only for e-commerce, a hardcoded 55 anchor
 * for lead-gen and a flat 50 for everything else, moved by two step boosts (+10 CTR ≥ 1.5%,
 * −15 frequency > 3.5). Every lead-gen account therefore landed on exactly 50, 55 or 65 — the
 * score carried no information.
 *
 * This version blends six independent dimensions, each mapped through a continuous benchmark curve
 * (no step functions), then renormalises over whichever dimensions the window can actually measure:
 *
 *   roi              ROAS vs benchmark              e-commerce windows only (purchase revenue seen)
 *   conversion_rate  conversions per click          any window with conversions or enough traffic
 *   ctr              click-through rate             any window with impressions
 *   frequency        audience saturation            any window with reach
 *   consistency      delivery coverage + stability  windows of ≥ 5 days
 *   momentum         second half vs first half      windows of ≥ 6 days with both halves active
 *
 * The blend is then shrunk toward 50 by a volume confidence factor, so a 300-impression window
 * can't post a 95 or a 5 off noise.
 *
 * Deliberately dependency-free and computed only from the window's own rows (never from targets or
 * the previous period) so every surface — dashboard card, report page, email, AI prompt — derives
 * the same number from the same snapshots.
 */

export type ScoreComponentKey = "roi" | "conversion_rate" | "ctr" | "frequency" | "consistency" | "momentum";

export interface ScoreComponent {
    key: ScoreComponentKey;
    label: string;
    /** 0-100 sub-score on this dimension. */
    score: number;
    /** Relative weight in the blend (renormalised over the components actually present). */
    weight: number;
    /** The measured input, for report/debug output ("ROAS 3.42x"). */
    detail: string;
}

export interface PerformanceScore {
    score: number;
    label: ScoreLabel;
    /** Only the dimensions this window could measure, in weight order. */
    components: ScoreComponent[];
    /** 0-1 volume confidence; the blend is pulled toward 50 in proportion to what's missing. */
    confidence: number;
}

/** One day of the window. Zero-delivery days are included — they count against consistency. */
export interface ScoreDay {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    linkClicks: number | null;
    conversions: number;
    revenue: number | null;
}

export interface ScoreInput {
    spend: number;
    impressions: number;
    /** Clicks on the basis the window's rates use (link clicks when fully broken out, else all). */
    clickBasis: number;
    /** Which series clickBasis came from — CTR is benchmarked against a different curve for each. */
    ctrBasis: "link" | "all";
    conversions: number;
    /** Purchases specifically — decides which conversion-rate benchmark the window is judged on. */
    purchases: number;
    revenue: number | null;
    frequency: number | null;
    ctr: number | null;
    roas: number | null;
    days: ScoreDay[];
}

const WEIGHTS: Record<ScoreComponentKey, number> = {
    roi: 45,
    conversion_rate: 25,
    ctr: 20,
    frequency: 10,
    consistency: 10,
    momentum: 10,
};

/**
 * Conversion rate is a factor of ROAS, so on windows that measure revenue it is dialled back —
 * otherwise the same success is paid for twice and ROI stops driving the e-commerce score.
 */
const CVR_WEIGHT_WITH_ROI = 15;

/** Below this, a window with zero conversions is thin traffic rather than a failure to convert. */
const MIN_CLICKS_FOR_CVR = 50;

/** Outcome dimensions — what the spend was for. The rest are hygiene. */
const OUTCOME_KEYS: readonly ScoreComponentKey[] = ["roi", "conversion_rate"];

/**
 * How far the hygiene dimensions may lift a window above its outcome. An account can deliver every
 * day, at a perfect frequency, with an eye-catching CTR, and still convert nobody — without this
 * ceiling that account blends its way to a passing 47 on the strength of its hygiene alone.
 */
const HYGIENE_HEADROOM = 30;

type Anchor = readonly [input: number, score: number];

/**
 * Piecewise-linear benchmark curve: maps a metric to 0-100 by interpolating between anchor points
 * (which must be sorted by input), flat outside the ends. Anchors keep each dimension's judgement
 * readable and tunable in one place, and — unlike the old ±10/±15 steps — two accounts that differ
 * slightly on an input differ slightly in score.
 */
function curve(value: number, anchors: readonly Anchor[]): number {
    if (!Number.isFinite(value) || value <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
        const [x0, y0] = anchors[i - 1];
        const [x1, y1] = anchors[i];
        if (value <= x1) return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
    return anchors[anchors.length - 1][1];
}

// Meta benchmarks. ROAS: ~2x is around break-even for most retail margins, 4x is a good account.
const ROAS_CURVE: readonly Anchor[] = [
    [0, 0],
    [0.5, 10],
    [1, 28],
    [1.5, 42],
    [2, 55],
    [3, 70],
    [4, 82],
    [6, 93],
    [10, 100],
];

// Conversions per click, benchmarked per account type — a 5% conversion rate is unremarkable for a
// lead form and excellent for a checkout, so one shared curve would systematically flatter lead-gen.
const LEAD_CVR_CURVE: readonly Anchor[] = [
    [0, 0],
    [0.01, 15],
    [0.025, 32],
    [0.05, 50],
    [0.08, 66],
    [0.12, 80],
    [0.18, 92],
    [0.3, 100],
];

const PURCHASE_CVR_CURVE: readonly Anchor[] = [
    [0, 0],
    [0.003, 12],
    [0.008, 30],
    [0.015, 48],
    [0.025, 65],
    [0.04, 80],
    [0.07, 92],
    [0.12, 100],
];

// Link CTR — what Ads Manager's "CTR (link)" column reports; ~1% is the common Meta average.
const LINK_CTR_CURVE: readonly Anchor[] = [
    [0, 0],
    [0.2, 10],
    [0.5, 28],
    [0.8, 42],
    [1.2, 58],
    [1.8, 72],
    [2.5, 82],
    [4, 93],
    [6, 100],
];

// All-clicks CTR runs roughly twice link CTR (it counts reactions, profile taps, expands), so a
// window that fell back to the all-clicks basis is judged on a stretched curve, not the link one.
const ALL_CTR_CURVE: readonly Anchor[] = [
    [0, 0],
    [0.4, 10],
    [1, 28],
    [1.6, 42],
    [2.4, 58],
    [3.6, 72],
    [5, 82],
    [8, 93],
    [12, 100],
];

// Impressions per person. Under ~1.2 the audience is barely being reinforced; 1.5-2.5 is healthy;
// past ~3.5 creative fatigue and rising CPMs set in.
const FREQUENCY_CURVE: readonly Anchor[] = [
    [0.9, 78],
    [1.3, 95],
    [1.8, 100],
    [2.5, 92],
    [3, 80],
    [3.5, 66],
    [4.5, 45],
    [6, 22],
    [9, 0],
];

// Share of the window's days that actually delivered.
const COVERAGE_CURVE: readonly Anchor[] = [
    [0, 0],
    [0.4, 30],
    [0.7, 60],
    [0.9, 85],
    [1, 100],
];

// Coefficient of variation of daily spend across delivering days — steady pacing scores high,
// stop-start delivery low.
const STABILITY_CURVE: readonly Anchor[] = [
    [0, 100],
    [0.3, 92],
    [0.6, 75],
    [1, 50],
    [1.5, 25],
    [2.5, 0],
];

// Second half vs first half of the window on the account's primary outcome.
const MOMENTUM_CURVE: readonly Anchor[] = [
    [0.4, 5],
    [0.7, 25],
    [0.9, 45],
    [1, 55],
    [1.15, 70],
    [1.4, 85],
    [2, 100],
];

// How much of the blend survives the shrink toward 50, by impressions in the window.
const VOLUME_CONFIDENCE_CURVE: readonly Anchor[] = [
    [0, 0.2],
    [500, 0.45],
    [2000, 0.7],
    [5000, 0.88],
    [10000, 1],
];

// ...and by how much of the picture the window could measure at all (summed component weight). A
// verdict resting on CTR alone is worth less than one resting on ROI, conversions and delivery.
const BREADTH_CONFIDENCE_CURVE: readonly Anchor[] = [
    [20, 0.6],
    [45, 0.8],
    [65, 0.95],
    [85, 1],
];

const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));
const fmt = (v: number, digits = 2): string => v.toFixed(digits);
const pct = (v: number): string => `${v.toFixed(2)}%`;

/** Coefficient of variation (σ/μ). Null when there aren't enough points to mean anything. */
function coefficientOfVariation(values: number[]): number | null {
    if (values.length < 3) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean <= 0) return null;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / mean;
}

interface HalfTotals {
    spend: number;
    impressions: number;
    clickBasis: number;
    conversions: number;
    revenue: number;
}

function sumHalf(days: ScoreDay[], ctrBasis: "link" | "all"): HalfTotals {
    return days.reduce<HalfTotals>(
        (acc, d) => ({
            spend: acc.spend + d.spend,
            impressions: acc.impressions + d.impressions,
            clickBasis: acc.clickBasis + (ctrBasis === "link" ? (d.linkClicks ?? 0) : d.clicks),
            conversions: acc.conversions + d.conversions,
            revenue: acc.revenue + (d.revenue ?? 0),
        }),
        { spend: 0, impressions: 0, clickBasis: 0, conversions: 0, revenue: 0 },
    );
}

/**
 * The "is it getting better or worse" ratio, on whichever outcome the account is measured by:
 * ROAS for e-commerce, conversions-per-spend for lead-gen, CTR when nothing converts. Returns null
 * when the first half has no baseline to compare against.
 */
function momentumRatio(
    first: HalfTotals,
    second: HalfTotals,
    kind: "roas" | "conversions" | "ctr",
): { ratio: number; metric: string } | null {
    const rate = (h: HalfTotals): number | null => {
        if (kind === "roas") return h.spend > 0 ? h.revenue / h.spend : null;
        if (kind === "conversions") return h.spend > 0 ? h.conversions / h.spend : null;
        return h.impressions > 0 ? h.clickBasis / h.impressions : null;
    };
    const a = rate(first);
    const b = rate(second);
    if (a == null || b == null || a <= 0) return null;
    const metric = kind === "roas" ? "ROAS" : kind === "conversions" ? "conversions per spend" : "CTR";
    return { ratio: b / a, metric };
}

export function scoreLabel(score: number): ScoreLabel {
    return score >= 70 ? ScoreLabel.STRONG : score >= 40 ? ScoreLabel.MODERATE : ScoreLabel.NEEDS_IMPROVEMENT;
}

export function scorePerformance(input: ScoreInput): PerformanceScore {
    const { spend, impressions, clickBasis, ctrBasis, conversions, purchases, revenue, frequency, ctr, roas } = input;
    const days = [...input.days].sort((a, b) => a.date.localeCompare(b.date));
    const components: ScoreComponent[] = [];

    const add = (key: ScoreComponentKey, label: string, score: number, detail: string, weight = WEIGHTS[key]) =>
        components.push({ key, label, score: Math.round(clamp100(score)), weight, detail });

    // --- Return on ad spend. E-commerce only: without measured purchase revenue there is no ROI
    // to judge, and inventing one is what produced the fake 74.5x (see lib/metrics/extract.ts).
    const hasRoi = revenue != null && spend > 0 && roas != null;
    if (hasRoi) {
        add("roi", "Return on ad spend", curve(roas, ROAS_CURVE), `ROAS ${fmt(roas)}x`);
    }

    // --- Conversion rate. Also scored when a window pushed real traffic and converted nobody —
    // that zero is a finding, not missing data.
    if (clickBasis > 0 && (conversions > 0 || clickBasis >= MIN_CLICKS_FOR_CVR)) {
        const cvr = conversions / clickBasis;
        const ecommerce = purchases > 0;
        add(
            "conversion_rate",
            ecommerce ? "Purchase rate" : "Conversion rate",
            curve(cvr, ecommerce ? PURCHASE_CVR_CURVE : LEAD_CVR_CURVE),
            `${pct(cvr * 100)} (${conversions} from ${clickBasis} clicks)`,
            hasRoi ? CVR_WEIGHT_WITH_ROI : WEIGHTS.conversion_rate,
        );
    }

    // --- Creative/audience relevance.
    if (ctr != null && impressions > 0) {
        const label = ctrBasis === "link" ? "Link CTR" : "CTR (all clicks)";
        add("ctr", label, curve(ctr, ctrBasis === "link" ? LINK_CTR_CURVE : ALL_CTR_CURVE), `${label} ${pct(ctr)}`);
    }

    // --- Saturation. Window reach is a sum of daily reach (Zernio exposes no period reach), so
    // this over-counts repeat users and the dimension is deliberately weighted light.
    if (frequency != null && frequency > 0) {
        add("frequency", "Audience saturation", curve(frequency, FREQUENCY_CURVE), `Frequency ${fmt(frequency)}`);
    }

    // --- Delivery health: did the account actually run, and did it run evenly?
    if (days.length >= 5) {
        const active = days.filter((d) => d.spend > 0 || d.impressions > 0);
        const coverage = active.length / days.length;
        const coverageScore = curve(coverage, COVERAGE_CURVE);
        const cv = coefficientOfVariation(active.map((d) => d.spend));
        const score = cv == null ? coverageScore : 0.6 * coverageScore + 0.4 * curve(cv, STABILITY_CURVE);
        const cvDetail = cv == null ? "" : `, spend CV ${fmt(cv)}`;
        add("consistency", "Delivery consistency", score, `${active.length}/${days.length} days delivering${cvDetail}`);
    }

    // --- Direction of travel inside the window (the previous period isn't available on every
    // surface that renders a score, so the trend has to come from the window's own days).
    if (days.length >= 6) {
        const mid = Math.floor(days.length / 2);
        const first = sumHalf(days.slice(0, mid), ctrBasis);
        const second = sumHalf(days.slice(mid), ctrBasis);
        const kind = revenue != null ? "roas" : conversions > 0 ? "conversions" : "ctr";
        const m = momentumRatio(first, second, kind);
        if (m) add("momentum", "Trend within period", curve(m.ratio, MOMENTUM_CURVE), `${m.metric} ${fmt(m.ratio)}x vs first half`);
    }

    // Nothing measurable (a window with no delivery at all): stay neutral rather than claim a 0,
    // which would read as "performed terribly" on the rating scale.
    if (components.length === 0) {
        return { score: 50, label: scoreLabel(50), components, confidence: 0 };
    }

    const totalWeight = components.reduce((a, c) => a + c.weight, 0);
    let blended = components.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight;

    // Cap the blend at the account's own outcome plus a fixed allowance (see HYGIENE_HEADROOM).
    // Only applied where an outcome was measurable at all — a window with too little traffic to
    // judge conversion has no outcome to be held to.
    const outcome = components.filter((c) => OUTCOME_KEYS.includes(c.key));
    if (outcome.length > 0) {
        const outcomeWeight = outcome.reduce((a, c) => a + c.weight, 0);
        const outcomeScore = outcome.reduce((a, c) => a + c.score * c.weight, 0) / outcomeWeight;
        blended = Math.min(blended, outcomeScore + HYGIENE_HEADROOM);
    }

    // Thin windows are noisy: 40 clicks and one conversion is not a 90, and a single flattering
    // dimension is not a verdict. Shrink toward neutral in proportion to how little the window
    // measured — in volume and in breadth.
    const confidence = curve(impressions, VOLUME_CONFIDENCE_CURVE) * curve(totalWeight, BREADTH_CONFIDENCE_CURVE);
    const score = Math.round(clamp100(50 + (blended - 50) * confidence));

    components.sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key));

    return { score, label: scoreLabel(score), components, confidence };
}
