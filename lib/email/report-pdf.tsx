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
import { deltaSigned, type MetricColumn } from "@/lib/metrics/present";
import type { ReportDocument } from "@/lib/report/template/document";
import { substitute } from "@/lib/report/template/parse";
import type { SectionBlock, TemplateBlock } from "@/lib/report/template/types";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * The report as a PDF attachment, rendered from the client's template.
 *
 * Every block the template declares is drawn here; the same blocks are drawn as HTML by
 * `components/email/report-email.tsx`. react-pdf is its own renderer with its own small style subset,
 * which is precisely why the template is a block format rather than HTML — arbitrary markup could not
 * be expressed here at all.
 *
 * Fonts are the PDF built-ins (Helvetica) on purpose: registering a web font would mean a network fetch
 * per render inside the send path.
 */
export interface ReportPdfProps {
    doc: ReportDocument;
}

const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";
const ITALIC = "Helvetica-Oblique";

// Orphan protection: points that must remain below a heading for it to stay on the page. Without it a
// heading lands at the bottom of a page with its body overleaf.
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

    // Template text blocks
    h1: { fontFamily: BOLD, fontSize: 20, marginTop: 14, marginBottom: 2 },
    h2: { fontFamily: BOLD, fontSize: 14, marginTop: 14, marginBottom: 2 },
    h3: {
        fontFamily: BOLD,
        fontSize: 8,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: muted,
        marginTop: 14,
        marginBottom: 6,
    },
    paragraph: { fontSize: 10, lineHeight: 1.6, color: bodyText, marginBottom: 4 },
    note: { fontSize: 9, lineHeight: 1.5, color: muted, marginBottom: 4 },
    divider: { borderTopWidth: 1, borderTopColor: border, marginVertical: 12 },
    empty: { fontSize: 10, lineHeight: 1.6, color: muted, fontFamily: ITALIC, marginBottom: 4 },
    block: { marginBottom: 8 },

    // Score
    card: { backgroundColor: white, borderWidth: 1, borderColor: border, padding: 12 },
    scoreRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    scoreValue: { fontFamily: BOLD, fontSize: 34 },
    // marginLeft, not a leading space: react-pdf collapses leading whitespace in a sibling Text.
    scoreMax: { fontSize: 13, color: muted, marginLeft: 3 },
    scoreLabel: {
        fontFamily: BOLD,
        fontSize: 8,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: muted,
        marginBottom: 6,
    },
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

    // AI-authored prose keeps a thin accent rail, so a reader can tell it from the client's own copy —
    // the template owns the headings now, so the label can no longer carry that signal.
    aiProse: { borderLeftWidth: 2, borderLeftColor: accent, paddingLeft: 8, marginBottom: 4 },

    footer: { marginTop: 22, paddingTop: 10, borderTopWidth: 1, borderTopColor: border, fontSize: 8, color: muted },
});

function Kpis({ columns }: { columns: MetricColumn[] }) {
    return (
        <View style={s.block} wrap={false}>
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

function Section({ section, doc }: { section: SectionBlock; doc: ReportDocument }) {
    const { sections, t } = doc;

    switch (section) {
        case "scoreCard": {
            const labelStyle = sections.scoreLabel ? SCORE_LABEL_STYLE[sections.scoreLabel] : null;

            return (
                <View style={[s.card, s.block]} wrap={false}>
                    <Text style={s.scoreLabel}>{t("report.performanceScore")}</Text>
                    <View style={s.scoreRow}>
                        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                            <Text style={s.scoreValue}>{sections.score ?? "—"}</Text>
                            <Text style={s.scoreMax}>/ 100</Text>
                        </View>
                        {labelStyle && sections.scoreLabel && (
                            <Text style={[s.badge, { color: labelStyle.color, backgroundColor: labelStyle.bg }]}>
                                {t(`score.${sections.scoreLabel}`)}
                            </Text>
                        )}
                    </View>
                </View>
            );
        }

        case "metricsTable":
            return <Kpis columns={sections.kpis} />;

        case "executiveSummary":
            return sections.executiveSummary ? (
                <View style={s.aiProse}>
                    <Text style={s.paragraph}>{sections.executiveSummary}</Text>
                </View>
            ) : (
                <Text style={s.empty}>{t("report.noSummary")}</Text>
            );

        case "trendExplanation":
            return sections.trendExplanation ? (
                <View style={s.aiProse}>
                    <Text style={s.paragraph}>{sections.trendExplanation}</Text>
                </View>
            ) : (
                <Text style={s.empty}>{t("report.noTrend")}</Text>
            );

        case "recommendations":
            if (sections.recommendations.length === 0) return <Text style={s.empty}>{t("email.nothingFlagged")}</Text>;

            return (
                <View style={s.block}>
                    {sections.recommendations.map((rec, i) => {
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
                    })}
                </View>
            );

        case "contextComment":
            // An absent context note is pruned from the block list before rendering (see
            // pruneEmptySections), so reaching here empty means the data vanished after parsing.
            return (
                <Text style={sections.contextComment ? s.paragraph : s.empty}>{sections.contextComment ?? "—"}</Text>
            );
    }
}

function Block({ block, doc }: { block: TemplateBlock; doc: ReportDocument }) {
    switch (block.kind) {
        case "heading": {
            const style = block.level === 1 ? s.h1 : block.level === 2 ? s.h2 : s.h3;
            return (
                <Text style={style} minPresenceAhead={KEEP_WITH_BODY}>
                    {substitute(block.text, doc.variables)}
                </Text>
            );
        }

        case "paragraph":
            return <Text style={s.paragraph}>{substitute(block.text, doc.variables)}</Text>;

        case "note":
            return <Text style={s.note}>{substitute(block.text, doc.variables)}</Text>;

        case "divider":
            return <View style={s.divider} />;

        case "section":
            return <Section section={block.section} doc={doc} />;
    }
}

export function ReportPdf({ doc }: ReportPdfProps) {
    const { t, variables } = doc;

    return (
        <Document
            title={`${variables.accountName} — ${t("email.performanceReport")}`}
            subject={variables.period}
            creator="Repolio"
            producer="Repolio"
            language={doc.locale}
        >
            <Page size="A4" style={s.page} wrap>
                {doc.blocks.map((block, i) => (
                    <Block key={i} block={block} doc={doc} />
                ))}

                <Text style={s.footer} fixed>
                    {t("email.sentBy", { period: variables.period })}
                </Text>
            </Page>
        </Document>
    );
}
