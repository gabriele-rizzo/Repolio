import type { ScoreLabel } from "@/generated/prisma/browser";
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
    SCORE_LABEL_STYLE,
    white,
} from "@/lib/email/theme";
import { deltaArrow, type MetricColumn, type Translator } from "@/lib/metrics/present";

/**
 * The one email a client receives when an admin validates their report batch. Deliberately compact:
 * every account gets a short summary row (score + three headline KPIs + what the AI flagged), and the
 * full write-up travels as a PDF attachment per account — so a client with eight ad accounts gets one
 * readable email instead of eight full-length ones.
 *
 * Email-safe like `report-email.tsx`: inline styles + table layout only, no Tailwind or theme CSS,
 * rendered to an HTML string on the server in the recipient's language.
 */
export interface BatchEmailItem {
    accountName: string;
    platformLabel: string;
    period: string;
    score: number | null;
    scoreLabel: ScoreLabel | null;
    /** The three headline KPIs for this account (from the shared six-column set). */
    kpis: MetricColumn[];
    recommendationCount: number;
    /** IMMEDIATE-priority recommendations — the only urgency worth surfacing in a summary. */
    urgentCount: number;
    viewUrl: string | null;
    /** Name of this account's attached PDF, so the body maps rows to files. */
    pdfFilename: string | null;
}

export interface BatchEmailProps {
    clientName: string;
    /** Overall span covered by the batch, e.g. "1 Jul – 30 Jul". */
    period: string;
    items: BatchEmailItem[];
    dashboardUrl: string | null;
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

const paragraph: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: bodyText, margin: 0 };

const card: React.CSSProperties = { backgroundColor: white, border: `1px solid ${border}`, padding: 16 };

const badge = (color: string, bg: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 600,
    color,
    backgroundColor: bg,
});

function AccountRow({ item, t }: { item: BatchEmailItem; t: Translator }) {
    const labelStyle = item.scoreLabel ? SCORE_LABEL_STYLE[item.scoreLabel] : null;

    return (
        <div style={{ ...card, marginBottom: 8 }}>
            {/* Account identity + score */}
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                    <tr>
                        <td style={{ verticalAlign: "top" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: ink }}>{item.accountName}</div>
                            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                                {item.platformLabel ? `${item.platformLabel} · ` : ""}
                                {item.period}
                            </div>
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "top", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 22, fontWeight: 700, color: ink }}>{item.score ?? "—"}</span>
                            <span style={{ fontSize: 12, color: muted }}> / 100</span>
                            {labelStyle && item.scoreLabel && (
                                <div style={{ marginTop: 4 }}>
                                    <span style={badge(labelStyle.color, labelStyle.bg)}>
                                        {t(`score.${item.scoreLabel}`)}
                                    </span>
                                </div>
                            )}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Three headline KPIs */}
            <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{ marginTop: 12, borderTop: `1px solid ${border}`, paddingTop: 12, tableLayout: "fixed" }}
            >
                <tbody>
                    <tr>
                        {item.kpis.map((m) => (
                            <td key={m.key} style={{ paddingTop: 12, verticalAlign: "top" }}>
                                <div style={{ fontSize: 10, color: muted, textTransform: "uppercase" }}>{m.label}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: ink, margin: "2px 0" }}>
                                    {m.value}
                                </div>
                                {m.delta && (
                                    <div style={{ fontSize: 11, color: deltaColor(m.delta.good) }}>
                                        {deltaArrow(m.delta)}
                                    </div>
                                )}
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>

            {/* What the AI flagged + where to read it in full */}
            <div style={{ marginTop: 12, fontSize: 12, color: muted }}>
                {item.recommendationCount > 0 ? (
                    <span style={{ color: accent, fontWeight: 600 }}>
                        {t("email.batch.flagged", {
                            count: item.recommendationCount,
                            urgent: item.urgentCount,
                        })}
                    </span>
                ) : (
                    t("email.nothingFlagged")
                )}
                {item.pdfFilename && (
                    <span>
                        {" · "}
                        {t("email.batch.attachedAs", { file: item.pdfFilename })}
                    </span>
                )}
            </div>

            {item.viewUrl && (
                <div style={{ marginTop: 10 }}>
                    <a href={item.viewUrl} style={{ fontSize: 13, fontWeight: 600, color: primary }}>
                        {t("email.viewFullReport")} →
                    </a>
                </div>
            )}
        </div>
    );
}

export function BatchEmail(props: BatchEmailProps) {
    const { t } = props;
    const count = props.items.length;

    return (
        <html lang={props.locale}>
            {/* eslint-disable-next-line @next/next/no-head-element -- standalone email document, not a Next page */}
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{t("email.batch.heading", { count })}</title>
            </head>

            <body
                style={{
                    margin: 0,
                    padding: "24px 0",
                    backgroundColor: pageBg,
                    fontFamily: fontStack,
                    color: ink,
                }}
            >
                <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
                    {/* Header */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ ...labelBase, margin: 0, color: muted }}>{t("email.performanceReport")}</div>
                        <h1 style={{ margin: "6px 0 2px", fontSize: 22, fontWeight: 700, color: ink }}>
                            {t("email.batch.heading", { count })}
                        </h1>
                        <div style={{ fontSize: 13, color: muted }}>{props.period}</div>
                    </div>

                    <p style={{ ...paragraph, marginBottom: 16 }}>
                        {t("email.batch.intro", { name: props.clientName, count })}
                    </p>

                    {props.items.map((item, i) => (
                        <AccountRow key={i} item={item} t={t} />
                    ))}

                    {/* Footer */}
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                        {props.dashboardUrl && (
                            <a
                                href={props.dashboardUrl}
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
                                {t("email.batch.openDashboard")}
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
