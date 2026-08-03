/**
 * The report template format.
 *
 * A template is HTML the client authors, with Supabase-style `{{ .variable }}` placeholders. It is the
 * source of the *deliverable* — the PDF attachment and the standalone HTML render — so both come out of
 * the same final markup and can't drift.
 *
 * Three placeholder kinds:
 *   - scalars, e.g. `{{ .spend }}` — substituted anywhere, HTML-escaped;
 *   - sections, e.g. `{{ .metricsTable }}` — replaced by a pre-built markup fragment for that block;
 *   - conditionals, `{{ #if .x }}…{{ /if }}` — kept only when `.x` has a real value for this report.
 *
 * Pipeline (order matters, see lib/report/template/render.ts): sanitize the client's HTML FIRST, then
 * substitute. Sanitizing afterwards would strip our own trusted fragments; substituting first would let
 * a client smuggle markup in through a value.
 *
 * PDF caveat: the PDF is produced by mapping this HTML onto react-pdf primitives, which support only a
 * subset of CSS. `UNSUPPORTED_PDF_CSS` below lists the properties that are silently dropped there, and
 * the editor warns about them rather than letting a template look right on screen and wrong in the PDF.
 */

/** Whole pre-designed sections, written as `{{ .name }}` anywhere in the markup. */
export const SECTION_BLOCKS = ["scoreCard", "metricsTable", "recommendations", "trendExplanation", "contextComment"] as const;

/**
 * Sections that no longer exist but may still sit in a saved template.
 *
 * Templates are stored per client/account as copies, so removing a section from the product does not
 * remove it from what clients already saved. A retired name is still RECOGNISED — it renders as
 * nothing (taking any heading directly above it with it) — because the alternative is the renderer
 * leaving a literal "{{ .executiveSummary }}" in a client-facing PDF. The editor flags it so an
 * author can clean it up.
 *
 * `executiveSummary`: the AI-written summary was removed from every report surface.
 */
export const RETIRED_SECTION_BLOCKS = ["executiveSummary"] as const;

export type ActiveSectionBlock = (typeof SECTION_BLOCKS)[number];
export type RetiredSectionBlock = (typeof RETIRED_SECTION_BLOCKS)[number];
export type SectionBlock = ActiveSectionBlock | RetiredSectionBlock;

export function isRetiredSectionBlock(name: string): name is RetiredSectionBlock {
    return (RETIRED_SECTION_BLOCKS as readonly string[]).includes(name);
}

/** True for any placeholder the renderer expands into a section — retired ones included (to nothing). */
export function isSectionBlock(name: string): name is SectionBlock {
    return (SECTION_BLOCKS as readonly string[]).includes(name) || isRetiredSectionBlock(name);
}

/** A problem found while checking a template. Surfaced in the editor, never thrown at render time. */
export interface TemplateIssue {
    kind:
        | "unknown-variable"
        | "retired-section"
        | "unsupported-pdf-css"
        | "stripped-markup"
        | "empty"
        | "unbalanced-conditional";
    message: string;
}

/** Matches a Supabase-style placeholder: `{{ .name }}`, whitespace optional. */
export const PLACEHOLDER = /\{\{\s*\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * A conditional block: `{{ #if .roasChange }}<div>…</div>{{ /if }}`.
 *
 * Exists because a metric with nothing to show still occupies its layout. An account on its FIRST report
 * has no previous window, so every `{{ .xChange }}` resolves to an em dash — and a card captioned
 * "— ggü. Vorperiode" is worse than no card at all. The same applies to a metric that is simply n/a for
 * an account: a lead-gen account has no ROAS, and printing a dash under a "ROAS" label reads as broken
 * rather than as not-applicable.
 *
 * Deliberately the ONLY control flow in the language: one test — "does this variable have a real value
 * for this report" — with no operators, comparisons or else-branch. Anything more and a client-authored
 * template becomes a program that can fail at render time, inside the delivery path.
 *
 * The body cannot contain another `#if` opener, which makes the match innermost-first; `resolveConditionals`
 * loops so nesting still works.
 */
export const CONDITIONAL_BLOCK =
    /\{\{\s*#if\s+\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}((?:(?!\{\{\s*#if\s)[\s\S])*?)\{\{\s*\/if\s*\}\}/;

/** Openers and closers on their own, for balance checking and for scrubbing unpaired leftovers. */
export const CONDITIONAL_OPEN = /\{\{\s*#if\s+\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
export const CONDITIONAL_CLOSE = /\{\{\s*\/if\s*\}\}/g;

/** Templates are client-authored; cap the size so a paste can't blow up a PDF render. */
export const MAX_TEMPLATE_LENGTH = 40_000;

/**
 * CSS the HTML render honours but the PDF cannot.
 *
 * Patterns use `(?<![\w-])` rather than `\b`: a word boundary also matches after the hyphen in
 * `text-transform` and `backdrop-filter`, which flagged `text-transform: uppercase` — a property the PDF
 * fully supports — as unsupported in every built-in preset.
 *
 * react-pdf implements its own layout engine with a subset of CSS — there is no grid, no floats, no
 * positioning and no media queries. A template using these looks correct in the preview and in the
 * downloaded HTML, then loses that styling in the attached PDF, which is the failure mode most likely to
 * ship unnoticed. The editor scans for them and says so.
 *
 * A known-list heuristic, not an exhaustive check of react-pdf's supported properties.
 */
export const UNSUPPORTED_PDF_CSS: { pattern: RegExp; label: string; advice: string }[] = [
    { pattern: /display\s*:\s*grid/i, label: "display: grid", advice: "use display: flex instead" },
    { pattern: /grid-template/i, label: "grid-template", advice: "use display: flex instead" },
    { pattern: /(?<![\w-])float\s*:\s*(left|right)/i, label: "float", advice: "use display: flex instead" },
    { pattern: /position\s*:\s*(absolute|fixed|sticky)/i, label: "position", advice: "not supported in the PDF" },
    { pattern: /@media/i, label: "@media", advice: "the PDF has one fixed page size" },
    { pattern: /box-shadow/i, label: "box-shadow", advice: "use a border instead" },
    { pattern: /border-collapse/i, label: "border-collapse", advice: "style the cell borders directly" },
    { pattern: /(?<![\w-])transform\s*:/i, label: "transform", advice: "not supported in the PDF" },
    { pattern: /(?<![\w-])filter\s*:/i, label: "filter", advice: "not supported in the PDF" },
    { pattern: /background-image|linear-gradient/i, label: "background-image", advice: "use a solid background" },
    // Not merely dropped — react-pdf cannot resolve em/rem for letter-spacing and THROWS, which would
    // fail the whole PDF. renderReportPdf falls back to the default template if that happens, but the
    // author should know before it ships.
    {
        pattern: /letter-spacing\s*:\s*[\d.]+\s*r?em/i,
        label: "letter-spacing in em",
        advice: "use px — em units break the PDF render entirely",
    },
];
