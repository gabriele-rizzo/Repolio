/**
 * Built-in report templates, as HTML.
 *
 * Presets live in code rather than the database: they need no migration to add, are always available (a
 * client with no template still gets a real report), and can't be deleted out from under a client.
 * Applying a preset COPIES its body — it does not link to it — so editing one here never silently
 * rewrites what an existing client already receives.
 *
 * Each stays inside the CSS the PDF can honour (no grid, no floats, no @media — see UNSUPPORTED_PDF_CSS)
 * so a preset always renders identically in the preview and in the attachment. A client is free to go
 * beyond that; the editor warns about what the PDF will drop.
 */

export interface TemplatePreset {
    id: string;
    name: string;
    description: string;
    body: string;
}

const DEFAULT_BODY = `<style>
  .head { margin-bottom: 16px; }
  .eyebrow { font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; color: #737373; }
  .title { font-size: 24px; font-weight: 700; margin: 6px 0 2px; }
  .period { font-size: 13px; color: #737373; }
  .section { font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase;
             font-weight: 600; color: #737373; margin: 20px 0 8px; }
</style>

<div class="head">
  <div class="eyebrow">{{ .platform }} · Performance report</div>
  <div class="title">{{ .accountName }}</div>
  <div class="period">{{ .period }}</div>
</div>

{{ .scoreCard }}

<div class="section">Metrics</div>
{{ .metricsTable }}

<div class="section">Executive summary</div>
{{ .executiveSummary }}

<div class="section">Recommendations</div>
{{ .recommendations }}

<div class="section">Trend explanation</div>
{{ .trendExplanation }}

<div class="section">Context</div>
{{ .contextComment }}
`;

const EXEC_BODY = `<style>
  .title { font-size: 26px; font-weight: 700; margin: 0 0 2px; }
  .sub { font-size: 13px; color: #737373; margin-bottom: 18px; }
  .section { font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase;
             font-weight: 600; color: #737373; margin: 22px 0 8px; }
  .rule { border-top: 1px solid #e5e5e5; margin: 24px 0; }
  .strip { background: #171717; color: #fafafa; padding: 14px 16px; margin-bottom: 16px; }
  .strip td { color: #fafafa; font-size: 12px; }
  .strip .big { font-size: 20px; font-weight: 700; }
</style>

<div class="title">{{ .accountName }}</div>
<div class="sub">{{ .period }} · prepared for {{ .clientName }}</div>

<table class="strip" width="100%"><tr>
  <td><div class="big">{{ .spend }}</div>spend {{ .spendChange }}</td>
  <td><div class="big">{{ .roas }}</div>ROAS {{ .roasChange }}</td>
  <td><div class="big">{{ .cpa }}</div>CPA {{ .cpaChange }}</td>
</tr></table>

<div class="section">The headline</div>
{{ .executiveSummary }}

<div class="section">What we're doing about it</div>
{{ .recommendations }}

<div class="rule"></div>

<div class="section">The numbers</div>
{{ .scoreCard }}
{{ .metricsTable }}
`;

const LEADGEN_BODY = `<style>
  .title { font-size: 24px; font-weight: 700; margin: 0 0 2px; }
  .sub { font-size: 13px; color: #737373; margin-bottom: 16px; }
  .hero { border: 1px solid #e5e5e5; background: #ffffff; padding: 20px; margin-bottom: 16px; }
  .hero .big { font-size: 32px; font-weight: 700; }
  .hero .cap { font-size: 12px; color: #737373; }
  .section { font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase;
             font-weight: 600; color: #737373; margin: 20px 0 8px; }
</style>

<div class="title">{{ .accountName }}</div>
<div class="sub">{{ .platform }} · {{ .period }}</div>

<div class="hero">
  <div class="big">{{ .leads }} leads at {{ .cpl }}</div>
  <div class="cap">Lead volume {{ .leadsChange }} · cost per lead {{ .cplChange }} · {{ .spend }} spent over {{ .days }} days</div>
</div>

<div class="section">Executive summary</div>
{{ .executiveSummary }}

<div class="section">Recommendations</div>
{{ .recommendations }}

<div class="section">Full metrics</div>
{{ .metricsTable }}

<div class="section">Trend explanation</div>
{{ .trendExplanation }}
`;

const MINIMAL_BODY = `<style>
  .title { font-size: 22px; font-weight: 700; margin: 0 0 2px; }
  .sub { font-size: 13px; color: #737373; margin-bottom: 20px; }
</style>

<div class="title">{{ .accountName }}</div>
<div class="sub">{{ .period }}</div>

{{ .executiveSummary }}
{{ .metricsTable }}
{{ .recommendations }}
`;

export const TEMPLATE_PRESETS: TemplatePreset[] = [
    {
        id: "default",
        name: "Standard",
        description: "Every section, in the classic order. The layout the report had before templates.",
        body: DEFAULT_BODY,
    },
    {
        id: "executive",
        name: "Executive",
        description: "A dark headline strip of the three key numbers, narrative first, detail last.",
        body: EXEC_BODY,
    },
    {
        id: "leadgen",
        name: "Lead generation",
        description: "Opens on leads and cost per lead instead of ROAS, for accounts with no purchases.",
        body: LEADGEN_BODY,
    },
    { id: "minimal", name: "Minimal", description: "Summary, metrics, recommendations. Nothing else.", body: MINIMAL_BODY },
];

/** The template used when a client has never set one. */
export const DEFAULT_TEMPLATE_BODY = DEFAULT_BODY;

export function findPreset(id: string): TemplatePreset | undefined {
    return TEMPLATE_PRESETS.find((p) => p.id === id);
}
