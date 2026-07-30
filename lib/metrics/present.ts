import { currencyFormatter } from "@/lib/format/currency";
import {
    accountFocus,
    METRIC_CARD_DEFS,
    selectKpiCards,
    type MetricCardKey,
    type MetricFormat,
} from "@/lib/metrics/cards";
import type { ComputedMetrics } from "@/lib/metrics/compute";

/** Minimal translator shape — the real next-intl `t` (for the recipient's locale) is passed in. */
export type Translator = (key: string, values?: Record<string, string | number>) => string;

export type BetterWhen = "up" | "down" | "neutral";

export interface MetricDelta {
    /** Unsigned, rounded magnitude of the change, e.g. "12%". */
    percent: string;
    direction: "up" | "down" | "flat";
    /** null when the metric has no better direction (e.g. spend), so renderers stay neutral. */
    good: boolean | null;
}

/**
 * Arrow-prefixed delta for surfaces that can render geometric glyphs — the web UI and the HTML email.
 */
export const deltaArrow = (d: MetricDelta): string =>
    d.direction === "flat" ? d.percent : `${d.direction === "up" ? "▲" : "▼"} ${d.percent}`;

/**
 * Sign-prefixed delta for the PDF. The attachment uses the built-in Helvetica, whose WinAnsi
 * encoding has no ▲ / ▼ — embedding them there renders visible mojibake ("² 23%"), so the PDF gets
 * +/- instead. Registering a font that covers them would mean a network fetch inside the send path.
 */
export const deltaSigned = (d: MetricDelta): string =>
    d.direction === "flat" ? d.percent : `${d.direction === "up" ? "+" : "-"}${d.percent}`;

export interface MetricColumn {
    key: MetricCardKey;
    label: string;
    betterWhen: BetterWhen;
    /** Formatted current value, or "—" when the metric is n/a for this account. */
    value: string;
    /** Period-over-period change, or null when there is no comparable previous value. */
    delta: MetricDelta | null;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Period-over-period change for one metric. Returns null when there's nothing honest to compare
 * (either side missing, or a zero baseline that would divide to Infinity); sub-0.5% reads as flat
 * rather than a misleading "0%" arrow.
 */
export function metricDelta(
    current: number | null | undefined,
    previous: number | null | undefined,
    betterWhen: BetterWhen,
): MetricDelta | null {
    if (current == null || previous == null || previous === 0) return null;

    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (!isFinite(pct)) return null;
    if (Math.abs(pct) < 0.5) return { percent: "0%", direction: "flat", good: null };

    const up = pct > 0;
    const good = betterWhen === "neutral" ? null : betterWhen === "up" ? up : !up;
    return { percent: `${Math.abs(pct).toFixed(0)}%`, direction: up ? "up" : "down", good };
}

/**
 * The six KPI columns for a report surface: which metrics to show (from the account's focus), their
 * localised labels, formatted values and deltas. Shared by the HTML email and the PDF attachment so
 * the two renderings can only differ in layout, never in numbers, labels or direction-of-good.
 *
 * Always returns exactly 6 entries — both renderers lay them out as a 3x2 grid.
 */
export function metricColumns(
    current: ComputedMetrics | null,
    previous: ComputedMetrics | null,
    t: Translator,
): MetricColumn[] {
    const money = currencyFormatter(current?.currency ?? previous?.currency ?? "EUR");

    const formats: Record<MetricFormat, (v: number) => string> = {
        currency: (v) => money.format(v),
        percent: (v) => `${v.toFixed(2)}%`,
        multiplier: (v) => `${v.toFixed(2)}x`,
        count: (v) => v.toLocaleString("en-US"),
        compact: (v) => compact.format(v),
        decimal: (v) => v.toFixed(2),
    };

    return selectKpiCards(accountFocus(current, previous)).map((key) => {
        const def = METRIC_CARD_DEFS[key];
        const value = current?.[key];

        return {
            key,
            label: t(`metrics.${key}`),
            betterWhen: def.betterWhen,
            value: value == null ? "—" : formats[def.format](value),
            delta: metricDelta(value, previous?.[key], def.betterWhen),
        };
    });
}
