import type { Recommendation } from "@/components/report/recommendation-card";
import type { ScoreLabel } from "@/generated/prisma/browser";
import { deltaColor, PRIORITY_STYLE, SCORE_LABEL_STYLE, priorityStyle } from "@/lib/email/theme";
import { deltaArrow, deltaSigned, type MetricColumn, type Translator } from "@/lib/metrics/present";
import type { DeltaStyle } from "@/lib/report/template/variables";
import type { SectionBlock } from "@/lib/report/template/types";

/**
 * The markup behind each `{{ .section }}` placeholder.
 *
 * Plain HTML strings rather than React, because the output feeds two very different consumers: the
 * standalone HTML document, and react-pdf (via an HTML→primitives mapping). A string is the only form
 * both accept.
 *
 * Styling is by CLASS, not inline style, so a template's own `<style>` can restyle any of these — the
 * default stylesheet below is emitted first, and later rules of equal specificity win. Inline styles
 * would have made these blocks unoverridable, which would defeat the point of HTML templates.
 */

/** Escapes text destined for HTML. Every value that came from data or a client goes through this. */
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Preserves author line breaks in AI prose, which arrives as plain text with \n\n paragraphs. */
function paragraphs(text: string): string {
    return text
        .split(/\n{2,}/)
        .map((block) => `<p class="rp-p">${escapeHtml(block.trim()).replace(/\n/g, "<br />")}</p>`)
        .join("");
}

/**
 * Default styling for the built-in sections. Emitted before the template's own markup so a client's
 * `<style>` can override any of it. Deliberately scoped to `rp-` classes so it can't restyle a
 * template's own elements.
 */
export const SECTION_STYLESHEET = `
.rp-card { background: #ffffff; border: 1px solid #e5e5e5; padding: 16px; margin-bottom: 12px; }
.rp-label { font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; font-weight: 600; color: #737373; margin-bottom: 8px; }
.rp-score-value { font-size: 40px; font-weight: 700; color: #0a0a0a; }
.rp-score-max { font-size: 16px; color: #737373; }
.rp-badge { display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: 600; }
.rp-kpis { display: flex; flex-direction: row; flex-wrap: wrap; margin-bottom: 12px; }
.rp-kpi { width: 33.3%; padding: 4px; }
.rp-kpi-inner { background: #ffffff; border: 1px solid #e5e5e5; padding: 10px; }
.rp-kpi-label { font-size: 10px; color: #737373; }
.rp-kpi-value { font-size: 16px; font-weight: 700; color: #0a0a0a; margin: 2px 0; }
.rp-kpi-delta { font-size: 10px; }
.rp-p { font-size: 12px; line-height: 1.6; color: #404040; margin: 0 0 8px; }
.rp-empty { font-size: 12px; line-height: 1.6; color: #737373; font-style: italic; margin: 0 0 8px; }
.rp-rec { background: #ffffff; border: 1px solid #e5e5e5; border-left-width: 3px; padding: 10px; margin-bottom: 8px; }
.rp-rec-head { display: flex; flex-direction: row; justify-content: space-between; }
.rp-rec-cat { font-size: 11px; color: #737373; }
.rp-rec-title { font-size: 13px; font-weight: 700; color: #0a0a0a; margin: 8px 0 2px; }
.rp-rec-body { font-size: 11px; line-height: 1.6; color: #404040; }
`.trim();

export interface SectionData {
    score: number | null;
    scoreLabel: ScoreLabel | null;
    kpis: MetricColumn[];
    executiveSummary: string;
    recommendations: Recommendation[];
    trendExplanation: string;
    contextComment: string | null;
    t: Translator;
    /**
     * How the KPI grid spells its deltas. MUST be "sign" for the PDF: its built-in Helvetica has no
     * ▲ / ▼ in WinAnsi encoding and renders them as mojibake. Kept alongside the scalar placeholders'
     * own delta style so the grid and inline `{{ .xChange }}` values always agree within one document.
     */
    deltaStyle: DeltaStyle;
}

function scoreCard({ score, scoreLabel, t }: SectionData): string {
    const style = scoreLabel ? SCORE_LABEL_STYLE[scoreLabel] : null;
    const badge =
        style && scoreLabel
            ? `<span class="rp-badge" style="color:${style.color};background:${style.bg}">${escapeHtml(
                  t(`score.${scoreLabel}`),
              )}</span>`
            : "";

    return `<div class="rp-card">
  <div class="rp-label">${escapeHtml(t("report.performanceScore"))}</div>
  <table width="100%"><tr>
    <td><span class="rp-score-value">${score ?? "—"}</span><span class="rp-score-max"> / 100</span></td>
    <td align="right">${badge}</td>
  </tr></table>
</div>`;
}

function metricsTable({ kpis, deltaStyle }: SectionData): string {
    const spell = deltaStyle === "sign" ? deltaSigned : deltaArrow;

    const cells = kpis
        .map(
            (m) => `<div class="rp-kpi"><div class="rp-kpi-inner">
      <div class="rp-kpi-label">${escapeHtml(m.label)}</div>
      <div class="rp-kpi-value">${escapeHtml(m.value)}</div>
      ${m.delta ? `<div class="rp-kpi-delta" style="color:${deltaColor(m.delta.good)}">${escapeHtml(spell(m.delta))}</div>` : ""}
    </div></div>`,
        )
        .join("");

    return `<div class="rp-kpis">${cells}</div>`;
}

function recommendations({ recommendations: recs, t }: SectionData): string {
    if (recs.length === 0) return `<p class="rp-empty">${escapeHtml(t("email.nothingFlagged"))}</p>`;

    return recs
        .map((rec) => {
            const p = priorityStyle(rec.priority);
            return `<div class="rp-rec" style="border-left-color:${p.rail}">
  <div class="rp-rec-head">
    <span class="rp-badge" style="color:${p.color};background:${p.bg}">${escapeHtml(t(`priority.${rec.priority}`))}</span>
    <span class="rp-rec-cat">${escapeHtml(t(`category.${rec.category}`))}</span>
  </div>
  <div class="rp-rec-title">${escapeHtml(rec.title)}</div>
  <div class="rp-rec-body">${escapeHtml(rec.body)}</div>
</div>`;
        })
        .join("");
}

/** Builds the markup for one section placeholder. */
export function renderSection(section: SectionBlock, data: SectionData): string {
    switch (section) {
        case "scoreCard":
            return scoreCard(data);
        case "metricsTable":
            return metricsTable(data);
        case "recommendations":
            return recommendations(data);
        case "executiveSummary":
            return data.executiveSummary
                ? paragraphs(data.executiveSummary)
                : `<p class="rp-empty">${escapeHtml(data.t("report.noSummary"))}</p>`;
        case "trendExplanation":
            return data.trendExplanation
                ? paragraphs(data.trendExplanation)
                : `<p class="rp-empty">${escapeHtml(data.t("report.noTrend"))}</p>`;
        case "contextComment":
            // Absent context collapses to nothing at all, so a template heading above it can be dropped
            // by the caller rather than printing above blank space.
            return data.contextComment?.trim() ? paragraphs(data.contextComment) : "";
    }
}

// Re-exported so the editor's colour legend and the section markup stay on one palette.
export { PRIORITY_STYLE };
