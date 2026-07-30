import type { Recommendation } from "@/components/report/recommendation-card";
import type { ScoreLabel } from "@/generated/prisma/browser";
import {
    accent,
    bodyText,
    border,
    deltaColor,
    ink,
    muted,
    pageBg,
    priorityStyle,
    SCORE_LABEL_STYLE,
    white,
} from "@/lib/email/theme";
import type { ComputedMetrics } from "@/lib/metrics/compute";
import { deltaSigned, metricColumns, type MetricColumn, type Translator } from "@/lib/metrics/present";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * The report as a PDF attachment. A deliberate re-authoring of `components/email/report-email.tsx`
 * in react-pdf primitives: react-pdf is its own renderer with its own (small) style subset, so the
 * HTML email can't be reused. Everything that is *data* — which KPIs, their labels, values and
 * deltas — comes from `lib/metrics/present.ts`, shared with the email, so only the layout is
 * duplicated here. Fonts are the PDF built-ins (Helvetica) on purpose: registering a web font would
 * mean a network fetch per render inside the send path.
 *
 * Rendered to bytes by `lib/email/render-batch.tsx`, one PDF per report in a validated batch.
 */
export interface ReportPdfProps {
    accountName: string;
    platformLabel: string;
    period: string;
    current: ComputedMetrics | null;
    previous: ComputedMetrics | null;
    executiveSummary: string;
    recommendations: Recommendation[];
    trendExplanation: string;
    contextComment: string | null;
    t: Translator;
    locale: string;
}

const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";
const ITALIC = "Helvetica-Oblique";

// Orphan protection: points that must remain on the page below a section label for it to stay put.
// Without it a label lands at the bottom of page 1 with its body on page 2 — which is exactly how the
// Context heading first rendered, as a title above blank space.
const KEEP_WITH_BODY = 60;

const s = StyleSheet.create({
    page: {
        backgroundColor: pageBg,
        color: ink,
        fontFamily: REGULAR,
        fontSize: 10,
        paddingVertical: 36,
        paddingHorizontal: 40,
    },

    // Header
    eyebrow: { fontFamily: BOLD, fontSize: 8, letterSpacing: 0.6, textTransform: "uppercase", color: muted },
    title: { fontFamily: BOLD, fontSize: 20, marginTop: 6, marginBottom: 2 },
    period: { fontSize: 10, color: muted },

    // Generic section
    section: { marginTop: 16 },
    sectionLabel: {
        fontFamily: BOLD,
        fontSize: 8,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: muted,
        marginBottom: 6,
    },
    aiLabel: {
        fontFamily: BOLD,
        fontSize: 8,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: accent,
        marginBottom: 6,
    },
    card: { backgroundColor: white, borderWidth: 1, borderColor: border, padding: 12 },
    paragraph: { fontSize: 10, lineHeight: 1.6, color: bodyText },
    empty: { fontSize: 10, lineHeight: 1.6, color: muted, fontFamily: ITALIC },

    // Score
    scoreRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    scoreValue: { fontFamily: BOLD, fontSize: 34 },
    // marginLeft, not a leading space: react-pdf collapses leading whitespace in a sibling Text.
    scoreMax: { fontSize: 13, color: muted, marginLeft: 3 },
    badge: { fontFamily: BOLD, fontSize: 8, paddingVertical: 3, paddingHorizontal: 6 },

    // KPI grid — 3 columns x 2 rows (the shared column set is always exactly 6).
    kpiRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
    kpiCell: { flexGrow: 1, flexBasis: 0, backgroundColor: white, borderWidth: 1, borderColor: border, padding: 8 },
    kpiLabel: { fontSize: 8, color: muted },
    kpiValue: { fontFamily: BOLD, fontSize: 13, marginTop: 2, marginBottom: 1 },
    kpiDelta: { fontSize: 8 },

    // Recommendations
    rec: {
        backgroundColor: white,
        borderWidth: 1,
        borderColor: border,
        borderLeftWidth: 3,
        padding: 10,
        marginBottom: 6,
    },
    recHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    recCategory: { fontSize: 9, color: muted },
    recTitle: { fontFamily: BOLD, fontSize: 11, marginTop: 8, marginBottom: 2 },
    recBody: { fontSize: 9.5, lineHeight: 1.6, color: bodyText },

    footer: { marginTop: 22, paddingTop: 10, borderTopWidth: 1, borderTopColor: border, fontSize: 8, color: muted },
});

function Kpis({ columns }: { columns: MetricColumn[] }) {
    return (
        <View>
            {[0, 3].map((start) => (
                <View key={start} style={s.kpiRow}>
                    {columns.slice(start, start + 3).map((m) => (
                        <View key={m.key} style={s.kpiCell}>
                            <Text style={s.kpiLabel}>{m.label}</Text>
                            <Text style={s.kpiValue}>{m.value}</Text>
                            {m.delta ? (
                                <Text style={[s.kpiDelta, { color: deltaColor(m.delta.good) }]}>
                                    {deltaSigned(m.delta)}
                                </Text>
                            ) : (
                                // Keeps every cell the same height so the two rows line up.
                                <Text style={[s.kpiDelta, { color: white }]}>—</Text>
                            )}
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
}

export function ReportPdf(props: ReportPdfProps) {
    const { current, previous, t } = props;
    const columns = metricColumns(current, previous, t);
    const scoreLabel: ScoreLabel | undefined = current?.score_label;
    const labelStyle = scoreLabel ? SCORE_LABEL_STYLE[scoreLabel] : null;

    return (
        <Document
            title={`${props.accountName} — ${t("email.performanceReport")}`}
            subject={props.period}
            creator="Repolio"
            producer="Repolio"
            language={props.locale}
        >
            <Page size="A4" style={s.page} wrap>
                <View>
                    <Text style={s.eyebrow}>
                        {props.platformLabel ? `${props.platformLabel} · ` : ""}
                        {t("email.performanceReport")}
                    </Text>
                    <Text style={s.title}>{props.accountName}</Text>
                    <Text style={s.period}>{props.period}</Text>
                </View>

                {/* Score */}
                <View style={[s.section, s.card]} wrap={false}>
                    <Text style={s.sectionLabel}>{t("report.performanceScore")}</Text>
                    <View style={s.scoreRow}>
                        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                            <Text style={s.scoreValue}>{current?.performance_score ?? "—"}</Text>
                            <Text style={s.scoreMax}>/ 100</Text>
                        </View>
                        {labelStyle && scoreLabel && (
                            <Text style={[s.badge, { color: labelStyle.color, backgroundColor: labelStyle.bg }]}>
                                {t(`score.${scoreLabel}`)}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Metrics */}
                <View style={s.section} wrap={false}>
                    <Text style={s.sectionLabel} minPresenceAhead={KEEP_WITH_BODY}>
                        {t("report.metrics")}
                    </Text>
                    <Kpis columns={columns} />
                </View>

                {/* Executive summary (AI) */}
                <View style={s.section}>
                    <Text style={s.aiLabel} minPresenceAhead={KEEP_WITH_BODY}>
                        {t("report.executiveSummary")}
                    </Text>
                    <Text style={props.executiveSummary ? s.paragraph : s.empty}>
                        {props.executiveSummary || t("report.noSummary")}
                    </Text>
                </View>

                {/* Recommendations (AI) */}
                <View style={s.section}>
                    <Text style={s.aiLabel} minPresenceAhead={KEEP_WITH_BODY}>
                        {t("report.recommendations")}
                    </Text>

                    {props.recommendations.length === 0 ? (
                        <Text style={s.empty}>{t("email.nothingFlagged")}</Text>
                    ) : (
                        props.recommendations.map((rec, i) => {
                            const p = priorityStyle(rec.priority);

                            return (
                                <View key={i} style={[s.rec, { borderLeftColor: p.rail }]} wrap={false}>
                                    <View style={s.recHead}>
                                        <Text style={[s.badge, { color: p.color, backgroundColor: p.bg }]}>
                                            {t(`priority.${rec.priority}`)}
                                        </Text>
                                        <Text style={s.recCategory}>{t(`category.${rec.category}`)}</Text>
                                    </View>
                                    <Text style={s.recTitle}>{rec.title}</Text>
                                    <Text style={s.recBody}>{rec.body}</Text>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Trend explanation (AI) */}
                <View style={s.section}>
                    <Text style={s.aiLabel} minPresenceAhead={KEEP_WITH_BODY}>
                        {t("report.trendExplanation")}
                    </Text>
                    <Text style={props.trendExplanation ? s.paragraph : s.empty}>
                        {props.trendExplanation || t("report.noTrend")}
                    </Text>
                </View>

                {/* Context (only if the client added one) */}
                {props.contextComment && (
                    <View style={s.section} wrap={false}>
                        <Text style={s.sectionLabel} minPresenceAhead={KEEP_WITH_BODY}>
                            {t("report.context")}
                        </Text>
                        <Text style={s.paragraph}>{props.contextComment}</Text>
                    </View>
                )}

                <Text style={s.footer} fixed>
                    {t("email.sentBy", { period: props.period })}
                </Text>
            </Page>
        </Document>
    );
}
