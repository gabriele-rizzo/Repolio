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

<div class="section">Trend explanation</div>
{{ .trendExplanation }}

<div class="section">Recommendations</div>
{{ .recommendations }}

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
{{ .trendExplanation }}

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

<div class="section">Trend explanation</div>
{{ .trendExplanation }}

<div class="section">Recommendations</div>
{{ .recommendations }}

<div class="section">Full metrics</div>
{{ .metricsTable }}
`;

const MINIMAL_BODY = `<style>
  .title { font-size: 22px; font-weight: 700; margin: 0 0 2px; }
  .sub { font-size: 13px; color: #737373; margin-bottom: 20px; }
</style>

<div class="title">{{ .accountName }}</div>
<div class="sub">{{ .period }}</div>

{{ .metricsTable }}
{{ .recommendations }}
`;

const DARK_BODY = `<style>
  /* Page colours. Read by both renderers — the PDF page and the HTML body are painted outside the
     template's reach, so a dark design has to declare them here. */
  :root { --rp-page-bg: #05080d; --rp-page-fg: #eef2f6; }

  /* Two-column rows are flex, not tables: react-pdf's table handling stacks rows unreliably and the
     header blocks ended up drawn on top of each other.
     display:flex is stated explicitly even though react-pdf treats every box as flex already —
     browsers do not, and without it the HTML render (preview + Download) collapses into one column. */
  .row      { display: flex; flex-direction: row; justify-content: space-between; align-items: flex-start; }
  .right    { text-align: right; }

  /* Every two-column row states BOTH column widths. react-pdf sizes a flex child from its own
     content and will not shrink it back to fit the row, so a column left to size itself — a header
     holding a 90-character ad-account name, say — grows past the page and shoves the column beside
     it off the sheet (the browser shrinks it instead, so the bug only ever showed up in the PDF).
     Percentages of the row are honoured identically by both renderers. */
  .col-main { width: 62%; padding-right: 10px; box-sizing: border-box; }
  .col-side { width: 38%; box-sizing: border-box; }
  /* Widths below include their own padding and border; react-pdf's box model already behaves this way. */
  .hero-left, .hero-right, .kpi, .reach { box-sizing: border-box; }

  .brand      { font-size: 17px; font-weight: 700; color: #eef2f6; }
  .brand-tag  { font-size: 6.5px; letter-spacing: 2px; text-transform: uppercase; color: #4a535e; margin-top: 3px; }
  .kicker     { font-size: 7.5px; letter-spacing: 2px; text-transform: uppercase; color: #5c6672; }
  .title      { font-size: 32px; font-weight: 700; color: #ffffff; }
  .subtitle   { font-size: 11px; color: #8b95a3; margin-top: 3px; }
  .period     { font-size: 11px; letter-spacing: 1.2px; color: #7cc4ff; margin-top: 5px; }
  .titlerow   { margin-top: 26px; }
  .rule       { border-top: 1px solid #161c26; margin-top: 20px; margin-bottom: 18px; }

  /* Hero: tall ROAS card on the left, KPI grid on the right. */
  .hero       { display: flex; flex-direction: row; align-items: stretch; }
  .hero-left  { width: 45%; padding-right: 6px; }
  .hero-right { width: 55%; }
  .card       { background: #0b1017; border: 1px solid #161c26; padding: 14px; }
  .card-hero  { background: #081218; border: 1px solid #172733; height: 238px;
                display: flex; flex-direction: column; justify-content: space-between; }
  .label      { font-size: 7.5px; letter-spacing: 2px; text-transform: uppercase; color: #6b7683; }

  .hero-value { font-size: 50px; font-weight: 700; color: #ffffff; }
  .hero-delta { font-size: 10px; color: #46d18b; margin-top: 8px; }

  .kpi-row    { display: flex; flex-direction: row; margin-bottom: 6px; }
  .kpi        { width: 50%; padding-left: 3px; padding-right: 3px; }
  .kpi-value  { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 7px; }
  .kpi-delta  { font-size: 9px; color: #46d18b; margin-top: 5px; }

  .reach       { padding-left: 3px; padding-right: 3px; }
  .reach-val   { font-size: 18px; font-weight: 700; color: #ffffff; }
  .reach-delta { font-size: 9px; color: #46d18b; margin-left: 8px; margin-top: 6px; }

  /* Section headings. */
  .sec        { font-size: 8px; letter-spacing: 2.4px; text-transform: uppercase; margin-bottom: 10px; }
  .sec-ai     { color: #7cc4ff; margin-top: 24px; }
  .panel      { background: #080d14; border: 1px solid #141b24; padding: 16px; margin-top: 18px; }

  /* The built-in section blocks default to dark-on-light text; this stylesheet is emitted after
     theirs, so these win. Without them the AI prose is near-invisible on a dark page. Margins are
     written out longhand — the shorthand is not applied reliably by the PDF renderer, which left
     paragraphs overlapping each other. */
  .rp-p       { color: #b8c2ce; font-size: 11px; line-height: 1.5; margin-top: 0; margin-bottom: 9px; }
  .rp-empty   { color: #5c6672; font-size: 11px; margin-top: 0; margin-bottom: 9px; }

  .foot       { font-size: 7.5px; letter-spacing: 1.6px; text-transform: uppercase; color: #4a535e; }
</style>

<div class="row">
  <div class="col-main">
    <div class="brand">{{ .company }}</div>
    <div class="brand-tag">videosolutions</div>
  </div>
  <div class="col-side kicker right">Performance - Report</div>
</div>

<div class="row titlerow">
  <div class="col-main">
    <div class="title">{{ .accountName }}</div>
    <div class="subtitle">Monatsauswertung</div>
  </div>
  <div class="col-side">
    <div class="kicker right">Zeitraum</div>
    <div class="period right">{{ .period }}</div>
  </div>
</div>

<div class="rule"></div>

<div class="hero">
  <div class="hero-left">
    <div class="card card-hero">
      <div class="label">ROAS</div>
      <div>
        <div class="hero-value">{{ .roas }}</div>
        <div class="hero-delta">{{ .roasChange }} ggü. Vorperiode</div>
      </div>
    </div>
  </div>

  <div class="hero-right">
    <div class="kpi-row">
      <div class="kpi"><div class="card">
        <div class="label">Ausgaben</div>
        <div class="kpi-value">{{ .spend }}</div>
        <div class="kpi-delta">{{ .spendChange }}</div>
      </div></div>
      <div class="kpi"><div class="card">
        <div class="label">CPA</div>
        <div class="kpi-value">{{ .cpa }}</div>
        <div class="kpi-delta">{{ .cpaChange }}</div>
      </div></div>
    </div>

    <div class="kpi-row">
      <div class="kpi"><div class="card">
        <div class="label">Conversions</div>
        <div class="kpi-value">{{ .conversions }}</div>
        <div class="kpi-delta">{{ .conversionsChange }}</div>
      </div></div>
      <div class="kpi"><div class="card">
        <div class="label">CTR</div>
        <div class="kpi-value">{{ .ctr }}</div>
        <div class="kpi-delta">{{ .ctrChange }}</div>
      </div></div>
    </div>

    <div class="reach"><div class="card">
      <div class="row">
        <div class="label">Reichweite</div>
        <div class="row">
          <div class="reach-val">{{ .reach }}</div>
          <div class="reach-delta">{{ .reachChange }}</div>
        </div>
      </div>
    </div></div>
  </div>
</div>

<div class="panel">
  <div class="sec sec-ai">KI-Trendanalyse</div>
  {{ .trendExplanation }}
</div>

<div class="rule"></div>

<div class="row">
  <div class="col-main foot">{{ .accountName }}</div>
  <div class="col-side foot right">Kennzahlen {{ .period }}</div>
</div>
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
    { id: "minimal", name: "Minimal", description: "Metrics and recommendations. Nothing else.", body: MINIMAL_BODY },
    {
        id: "dark",
        name: "Dark (Cinemepic)",
        description:
            "Dark editorial layout: brand header, ROAS hero beside a KPI grid, AI trend panel. German labels.",
        body: DARK_BODY,
    },
];

/** The template used when a client has never set one. */
export const DEFAULT_TEMPLATE_BODY = DEFAULT_BODY;

export function findPreset(id: string): TemplatePreset | undefined {
    return TEMPLATE_PRESETS.find((p) => p.id === id);
}
