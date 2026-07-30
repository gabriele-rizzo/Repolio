import type { Recommendation } from "@/components/report/recommendation-card";
import {
    accent,
    bodyText,
    border,
    deltaColor,
    fontStack,
    ink,
    muted,
    pageBg,
    primary,
    primaryFg,
    priorityStyle,
    SCORE_LABEL_STYLE,
    white,
} from "@/lib/email/theme";
import type { ComputedMetrics } from "@/lib/metrics/compute";
import { deltaArrow, metricColumns, type Translator } from "@/lib/metrics/present";

/**
 * Email-safe rendering of a report. Standalone from the dashboard UI on purpose: email clients
 * don't load Tailwind / theme CSS, so everything here is inline styles + table layout. The visual
 * language mirrors the app — neutral palette, square corners (the app uses --radius: 0), purple AI
 * accents. Rendered to an HTML string on the server via `renderReportEmail`, in the recipient
 * client's language (its `t` and `locale` are passed in).
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
    t: Translator;
    locale: string;
}

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

export function ReportEmail(props: ReportEmailProps) {
    const { current, previous, t } = props;
    const cols = metricColumns(current, previous, t);
    const score = current?.performance_score;
    const scoreLabel = current?.score_label;
    const labelStyle = scoreLabel ? SCORE_LABEL_STYLE[scoreLabel] : null;

    return (
        <html lang={props.locale}>
            {/* eslint-disable-next-line @next/next/no-head-element -- standalone email document, not a Next page */}
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{`${props.accountName} — ${t("email.performanceReport")}`}</title>
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
                            {props.platformLabel ? `${props.platformLabel} · ` : ""}
                            {t("email.performanceReport")}
                        </div>
                        <h1 style={{ margin: "6px 0 2px", fontSize: 22, fontWeight: 700, color: ink }}>
                            {props.accountName}
                        </h1>
                        <div style={{ fontSize: 13, color: muted }}>{props.period}</div>
                    </div>

                    {/* Score */}
                    <div style={{ ...card, padding: 20, marginBottom: 16 }}>
                        <div style={sectionLabel}>{t("report.performanceScore")}</div>
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
                                        {labelStyle && scoreLabel && (
                                            <span style={badge(labelStyle.color, labelStyle.bg)}>
                                                {t(`score.${scoreLabel}`)}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Metrics */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={sectionLabel}>{t("report.metrics")}</div>
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
                                        {[cols[row], cols[row + 1]].map((m) => (
                                            <td key={m.key} style={{ ...card, width: "50%", padding: 12, verticalAlign: "top" }}>
                                                <div style={{ fontSize: 11, color: muted }}>{m.label}</div>
                                                <div style={{ fontSize: 18, fontWeight: 700, margin: "2px 0", color: ink }}>
                                                    {m.value}
                                                </div>
                                                {m.delta && (
                                                    <div style={{ fontSize: 12, color: deltaColor(m.delta.good) }}>
                                                        {deltaArrow(m.delta)}
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Executive summary (AI) */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={aiLabel}>✦ {t("report.executiveSummary")}</div>
                        <p style={props.executiveSummary ? paragraph : emptyParagraph}>
                            {props.executiveSummary || t("report.noSummary")}
                        </p>
                    </div>

                    {/* Recommendations (AI) */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={aiLabel}>✦ {t("report.recommendations")}</div>

                        {props.recommendations.length === 0 ? (
                            <p style={emptyParagraph}>{t("email.nothingFlagged")}</p>
                        ) : (
                            props.recommendations.map((rec, i) => {
                                const p = priorityStyle(rec.priority);

                                return (
                                    <div key={i} style={{ ...card, borderLeft: `3px solid ${p.rail}`, marginBottom: 8 }}>
                                        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                            <tbody>
                                                <tr>
                                                    <td>
                                                        <span style={badge(p.color, p.bg)}>
                                                            {t(`priority.${rec.priority}`)}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: "right", fontSize: 12, color: muted }}>
                                                        {t(`category.${rec.category}`)}
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
                        <div style={aiLabel}>✦ {t("report.trendExplanation")}</div>
                        <p style={props.trendExplanation ? paragraph : emptyParagraph}>
                            {props.trendExplanation || t("report.noTrend")}
                        </p>
                    </div>

                    {/* Context (only if the client added one) */}
                    {props.contextComment && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={sectionLabel}>{t("report.context")}</div>
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
                                {t("email.viewFullReport")}
                            </a>
                        )}
                        <div style={{ marginTop: 12, fontSize: 12, color: muted }}>
                            {t("email.sentBy", { period: props.period })}
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
