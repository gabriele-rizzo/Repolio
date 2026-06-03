import type { ScoreLabel } from "@/generated/prisma/browser";
import type { Recommendation } from "@/components/report/recommendation-card";
import type { ComputedMetrics } from "@/lib/metrics/meta";

/**
 * Email-safe rendering of a report. Standalone from the dashboard UI on purpose: email clients
 * don't load Tailwind / theme CSS, so everything here is inline styles + table layout. The visual
 * language mirrors the app — neutral palette, square corners (the app uses --radius: 0), purple AI
 * accents. Rendered to an HTML string on the server via `renderReportEmail`.
 */
export interface ReportEmailProps {
    accountName: string;
    platformLabel: string;
    period: string;
    current: ComputedMetrics | null;
    previous: ComputedMetrics | null;
    executiveSummary: string;
    recommendations: Recommendation[];
    trendExplanation: string;
    contextComment: string | null;
    viewUrl: string | null;
}

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

type MetricKey = "spend" | "roas" | "cpa" | "conversions" | "ctr" | "reach";
type BetterWhen = "up" | "down" | "neutral";

const METRICS: { key: MetricKey; label: string; format: (v: number) => string; betterWhen: BetterWhen }[] = [
    { key: "spend", label: "Spend", format: (v) => currency.format(v), betterWhen: "neutral" },
    { key: "roas", label: "ROAS", format: (v) => `${v.toFixed(2)}x`, betterWhen: "up" },
    { key: "cpa", label: "CPA", format: (v) => currency.format(v), betterWhen: "down" },
    { key: "conversions", label: "Conversions", format: (v) => v.toLocaleString("en-US"), betterWhen: "up" },
    { key: "ctr", label: "CTR", format: (v) => `${v.toFixed(2)}%`, betterWhen: "up" },
    { key: "reach", label: "Reach", format: (v) => compact.format(v), betterWhen: "up" },
];

// Neutral palette + accents, matching the app's light theme (Tailwind neutral scale, --radius: 0).
const ink = "#0a0a0a"; // foreground
const bodyText = "#404040"; // neutral-700
const muted = "#737373"; // muted-foreground
const border = "#e5e5e5"; // border
const pageBg = "#fafafa";
const white = "#ffffff";
const primary = "#171717"; // primary (dark)
const primaryFg = "#fafafa";
const accent = "#7e22ce"; // purple-700, used for AI-generated sections
const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const SCORE_LABEL_STYLE: Record<ScoreLabel, { color: string; bg: string; label: string }> = {
    STRONG: { color: "#15803d", bg: "#f0fdf4", label: "Strong" },
    MODERATE: { color: "#b45309", bg: "#fffbeb", label: "Moderate" },
    NEEDS_IMPROVEMENT: { color: "#b91c1c", bg: "#fef2f2", label: "Needs improvement" },
};

const PRIORITY_STYLE: Record<string, { color: string; bg: string; rail: string; label: string }> = {
    IMMEDIATE: { color: "#b91c1c", bg: "#fef2f2", rail: "#ef4444", label: "Immediate" },
    THIS_WEEK: { color: "#b45309", bg: "#fffbeb", rail: "#f59e0b", label: "This week" },
    MONITOR: { color: "#1d4ed8", bg: "#eff6ff", rail: "#3b82f6", label: "Monitor" },
};

const CATEGORY_LABEL: Record<string, string> = {
    BUDGET: "Budget",
    CREATIVE: "Creative",
    TARGETING: "Targeting",
    BIDDING: "Bidding",
};

const labelBase: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontWeight: 600,
    margin: "0 0 8px",
};
const sectionLabel: React.CSSProperties = { ...labelBase, color: muted };
const aiLabel: React.CSSProperties = { ...labelBase, color: accent };

const paragraph: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.6,
    color: bodyText,
    whiteSpace: "pre-wrap",
    margin: 0,
};
const emptyParagraph: React.CSSProperties = { ...paragraph, fontStyle: "italic", color: muted };

const card: React.CSSProperties = {
    backgroundColor: white,
    border: `1px solid ${border}`,
    padding: 16,
};

const badge = (color: string, bg: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 600,
    color,
    backgroundColor: bg,
});

function delta(cur: number | null | undefined, prev: number | null | undefined, betterWhen: BetterWhen) {
    if (cur == null || prev == null || prev === 0) return null;
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    if (!isFinite(pct) || Math.abs(pct) < 0.5) return { text: "0%", color: muted };
    const up = pct > 0;
    const good = betterWhen === "neutral" ? null : betterWhen === "up" ? up : !up;
    const color = good == null ? muted : good ? "#15803d" : "#b91c1c";
    return { text: `${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`, color };
}

export function ReportEmail(props: ReportEmailProps) {
    const { current, previous } = props;
    const score = current?.performance_score;
    const labelStyle = current?.score_label ? SCORE_LABEL_STYLE[current.score_label] : null;

    return (
        <html lang="en">
            {/* eslint-disable-next-line @next/next/no-head-element -- standalone email document, not a Next page */}
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{`${props.accountName} — performance report`}</title>
            </head>

            <body
                style={{
                    margin: 0,
                    padding: "24px 0",
                    backgroundColor: pageBg,
                    fontFamily: fontStack,
                    color: ink,
                    // Keep card/badge backgrounds when this HTML is printed to PDF.
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                }}
            >
                <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
                    {/* Header */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ ...sectionLabel, margin: 0, color: muted }}>
                            {props.platformLabel ? `${props.platformLabel} · ` : ""}Performance report
                        </div>
                        <h1 style={{ margin: "6px 0 2px", fontSize: 22, fontWeight: 700, color: ink }}>
                            {props.accountName}
                        </h1>
                        <div style={{ fontSize: 13, color: muted }}>{props.period}</div>
                    </div>

                    {/* Score */}
                    <div style={{ ...card, padding: 20, marginBottom: 16 }}>
                        <div style={sectionLabel}>Performance score</div>
                        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                            <tbody>
                                <tr>
                                    <td style={{ verticalAlign: "bottom" }}>
                                        <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>
                                            {score ?? "—"}
                                        </span>
                                        <span style={{ fontSize: 18, color: muted }}> / 100</span>
                                    </td>
                                    <td style={{ textAlign: "right", verticalAlign: "bottom" }}>
                                        {labelStyle && (
                                            <span style={badge(labelStyle.color, labelStyle.bg)}>{labelStyle.label}</span>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Metrics */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={sectionLabel}>Metrics</div>
                        <table
                            role="presentation"
                            width="100%"
                            cellPadding={0}
                            cellSpacing={0}
                            style={{ borderCollapse: "separate", borderSpacing: 8, tableLayout: "fixed" }}
                        >
                            <tbody>
                                {[0, 2, 4].map((row) => (
                                    <tr key={row}>
                                        {[METRICS[row], METRICS[row + 1]].map((m) => {
                                            const value = current?.[m.key];
                                            const d = delta(value, previous?.[m.key], m.betterWhen);

                                            return (
                                                <td key={m.key} style={{ ...card, width: "50%", padding: 12, verticalAlign: "top" }}>
                                                    <div style={{ fontSize: 11, color: muted }}>{m.label}</div>
                                                    <div style={{ fontSize: 18, fontWeight: 700, margin: "2px 0", color: ink }}>
                                                        {value == null ? "—" : m.format(value)}
                                                    </div>
                                                    {d && <div style={{ fontSize: 12, color: d.color }}>{d.text}</div>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Executive summary (AI) */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={aiLabel}>✦ Executive summary</div>
                        <p style={props.executiveSummary ? paragraph : emptyParagraph}>
                            {props.executiveSummary || "No executive summary was generated for this report."}
                        </p>
                    </div>

                    {/* Recommendations (AI) */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={aiLabel}>✦ Recommendations</div>

                        {props.recommendations.length === 0 ? (
                            <p style={emptyParagraph}>Nothing actionable was flagged this period.</p>
                        ) : (
                            props.recommendations.map((rec, i) => {
                                const p = PRIORITY_STYLE[rec.priority] ?? {
                                    color: muted,
                                    bg: "#f5f5f5",
                                    rail: muted,
                                    label: rec.priority,
                                };
                                const category = CATEGORY_LABEL[rec.category] ?? rec.category;

                                return (
                                    <div key={i} style={{ ...card, borderLeft: `3px solid ${p.rail}`, marginBottom: 8 }}>
                                        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                            <tbody>
                                                <tr>
                                                    <td>
                                                        <span style={badge(p.color, p.bg)}>{p.label}</span>
                                                    </td>
                                                    <td style={{ textAlign: "right", fontSize: 12, color: muted }}>
                                                        {category}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div style={{ fontSize: 14, fontWeight: 600, margin: "10px 0 2px", color: ink }}>
                                            {rec.title}
                                        </div>
                                        <div style={{ fontSize: 13, lineHeight: 1.6, color: bodyText }}>{rec.body}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Trend explanation (AI) */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={aiLabel}>✦ AI trend explanation</div>
                        <p style={props.trendExplanation ? paragraph : emptyParagraph}>
                            {props.trendExplanation || "No trend explanation for this report yet."}
                        </p>
                    </div>

                    {/* Context (only if the client added one) */}
                    {props.contextComment && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={sectionLabel}>Context</div>
                            <p style={paragraph}>{props.contextComment}</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                        {props.viewUrl && (
                            <a
                                href={props.viewUrl}
                                style={{
                                    display: "inline-block",
                                    backgroundColor: primary,
                                    color: primaryFg,
                                    padding: "10px 16px",
                                    textDecoration: "none",
                                    fontSize: 14,
                                    fontWeight: 600,
                                }}
                            >
                                View full report
                            </a>
                        )}
                        <div style={{ marginTop: 12, fontSize: 12, color: muted }}>
                            Sent by Repolio · metrics cover {props.period}.
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
