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
import { deltaArrow, type MetricColumn } from "@/lib/metrics/present";
import type { ReportDocument } from "@/lib/report/template/document";
import { substitute } from "@/lib/report/template/parse";
import type { SectionBlock, TemplateBlock } from "@/lib/report/template/types";

/**
 * Email-safe HTML rendering of a report, from the client's template.
 *
 * Draws exactly the blocks that `lib/email/report-pdf.tsx` draws into the PDF, so the two deliverables
 * can only differ in presentation. Standalone from the dashboard UI on purpose: email clients don't
 * load Tailwind or theme CSS, so everything here is inline styles and table layout.
 *
 * Template text reaches the page as React children, never as `dangerouslySetInnerHTML` — so a client
 * who pastes markup into their template gets it printed as visible text rather than executed. That is
 * the whole reason the template is a block format instead of raw HTML.
 */
export interface ReportEmailProps {
    doc: ReportDocument;
    /** Deep link to the report in the dashboard. Omitted for the print/PDF render. */
    viewUrl: string | null;
}

const labelBase: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontWeight: 600,
};

const paragraph: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.6,
    color: bodyText,
    whiteSpace: "pre-wrap",
    margin: "0 0 8px",
};
const emptyParagraph: React.CSSProperties = { ...paragraph, fontStyle: "italic", color: muted };

const card: React.CSSProperties = { backgroundColor: white, border: `1px solid ${border}`, padding: 16 };

const badge = (color: string, bg: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 600,
    color,
    backgroundColor: bg,
});

// AI prose keeps a thin accent rail, matching the PDF — the template owns headings now, so the old
// purple section label can no longer signal which copy the model wrote.
const aiProse: React.CSSProperties = { borderLeft: `2px solid ${accent}`, paddingLeft: 10, marginBottom: 8 };

function Kpis({ columns }: { columns: MetricColumn[] }) {
    return (
        <table
            role="presentation"
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{ borderCollapse: "separate", borderSpacing: 8, tableLayout: "fixed", margin: "0 -8px 8px" }}
        >
            <tbody>
                {[0, 2, 4].map((row) => (
                    <tr key={row}>
                        {[columns[row], columns[row + 1]].map((m) =>
                            m ? (
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
                            ) : null,
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function Section({ section, doc }: { section: SectionBlock; doc: ReportDocument }) {
    const { sections, t } = doc;

    switch (section) {
        case "scoreCard": {
            const labelStyle = sections.scoreLabel ? SCORE_LABEL_STYLE[sections.scoreLabel] : null;

            return (
                <div style={{ ...card, padding: 20, marginBottom: 12 }}>
                    <div style={{ ...labelBase, color: muted, margin: "0 0 8px" }}>{t("report.performanceScore")}</div>
                    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                        <tbody>
                            <tr>
                                <td style={{ verticalAlign: "bottom" }}>
                                    <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>
                                        {sections.score ?? "—"}
                                    </span>
                                    <span style={{ fontSize: 18, color: muted }}> / 100</span>
                                </td>
                                <td style={{ textAlign: "right", verticalAlign: "bottom" }}>
                                    {labelStyle && sections.scoreLabel && (
                                        <span style={badge(labelStyle.color, labelStyle.bg)}>
                                            {t(`score.${sections.scoreLabel}`)}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            );
        }

        case "metricsTable":
            return <Kpis columns={sections.kpis} />;

        case "executiveSummary":
            return sections.executiveSummary ? (
                <div style={aiProse}>
                    <p style={paragraph}>{sections.executiveSummary}</p>
                </div>
            ) : (
                <p style={emptyParagraph}>{t("report.noSummary")}</p>
            );

        case "trendExplanation":
            return sections.trendExplanation ? (
                <div style={aiProse}>
                    <p style={paragraph}>{sections.trendExplanation}</p>
                </div>
            ) : (
                <p style={emptyParagraph}>{t("report.noTrend")}</p>
            );

        case "recommendations":
            if (sections.recommendations.length === 0) return <p style={emptyParagraph}>{t("email.nothingFlagged")}</p>;

            return (
                <div style={{ marginBottom: 8 }}>
                    {sections.recommendations.map((rec, i) => {
                        const p = priorityStyle(rec.priority);

                        return (
                            <div key={i} style={{ ...card, borderLeft: `3px solid ${p.rail}`, marginBottom: 8 }}>
                                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                                    <tbody>
                                        <tr>
                                            <td>
                                                <span style={badge(p.color, p.bg)}>{t(`priority.${rec.priority}`)}</span>
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
                    })}
                </div>
            );

        case "contextComment":
            return (
                <p style={sections.contextComment ? paragraph : emptyParagraph}>{sections.contextComment ?? "—"}</p>
            );
    }
}

function Block({ block, doc }: { block: TemplateBlock; doc: ReportDocument }) {
    switch (block.kind) {
        case "heading": {
            const text = substitute(block.text, doc.variables);

            if (block.level === 1) {
                return <h1 style={{ margin: "14px 0 2px", fontSize: 22, fontWeight: 700, color: ink }}>{text}</h1>;
            }
            if (block.level === 2) {
                return <h2 style={{ margin: "14px 0 2px", fontSize: 17, fontWeight: 700, color: ink }}>{text}</h2>;
            }
            return <div style={{ ...labelBase, color: muted, margin: "14px 0 8px" }}>{text}</div>;
        }

        case "paragraph":
            return <p style={paragraph}>{substitute(block.text, doc.variables)}</p>;

        case "note":
            return <p style={{ ...paragraph, fontSize: 13, color: muted }}>{substitute(block.text, doc.variables)}</p>;

        case "divider":
            return <div style={{ borderTop: `1px solid ${border}`, margin: "16px 0" }} />;

        case "section":
            return <Section section={block.section} doc={doc} />;
    }
}

export function ReportEmail({ doc, viewUrl }: ReportEmailProps) {
    const { t, variables } = doc;

    return (
        <html lang={doc.locale}>
            {/* eslint-disable-next-line @next/next/no-head-element -- standalone email document, not a Next page */}
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{`${variables.accountName} — ${t("email.performanceReport")}`}</title>
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
                    {doc.blocks.map((block, i) => (
                        <Block key={i} block={block} doc={doc} />
                    ))}

                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                        {viewUrl && (
                            <a
                                href={viewUrl}
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
                            {t("email.sentBy", { period: variables.period })}
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
