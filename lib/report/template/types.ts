/**
 * The report template format.
 *
 * A template is a plain-text document the client authors, with Supabase-style `{{ .variable }}`
 * placeholders. It is the source of the *deliverable* — the PDF attachment and the standalone HTML
 * render — so both are produced from the same parsed blocks and can't drift.
 *
 * Why a block format rather than HTML (which is what Supabase's email templates are): the PDF is
 * rendered by react-pdf, which has its own primitives and cannot render arbitrary HTML. A constrained
 * line-based format parses into blocks that BOTH renderers can express, which is what makes one
 * template drive a PDF and an email at once.
 *
 * Line syntax:
 *   # Heading            level-1 heading
 *   ## Heading           level-2 heading
 *   ### LABEL            small uppercase section label (the app's own visual idiom)
 *   > note               small muted note
 *   ---                  horizontal divider
 *   {{ .scoreCard }}     a RICH BLOCK, alone on its line (see SECTION_BLOCKS)
 *   anything else        a paragraph; consecutive lines stay in the same paragraph
 *
 * Inline `{{ .spend }}`-style placeholders are substituted inside headings, paragraphs and notes.
 */

/** Rich blocks: whole pre-designed sections, written alone on a line as `{{ .name }}`. */
export const SECTION_BLOCKS = [
    "scoreCard",
    "metricsTable",
    "executiveSummary",
    "recommendations",
    "trendExplanation",
    "contextComment",
] as const;

export type SectionBlock = (typeof SECTION_BLOCKS)[number];

export function isSectionBlock(name: string): name is SectionBlock {
    return (SECTION_BLOCKS as readonly string[]).includes(name);
}

export type TemplateBlock =
    | { kind: "heading"; level: 1 | 2 | 3; text: string }
    | { kind: "paragraph"; text: string }
    | { kind: "note"; text: string }
    | { kind: "divider" }
    | { kind: "section"; section: SectionBlock };

/** A problem found while parsing a template. Surfaced in the editor, never thrown at render time. */
export interface TemplateIssue {
    /** 1-indexed line in the template source. */
    line: number;
    kind: "unknown-variable" | "section-inline" | "empty";
    message: string;
}

export interface ParsedTemplate {
    blocks: TemplateBlock[];
    issues: TemplateIssue[];
    /** Which rich sections the template actually uses, for editor warnings about omitted AI output. */
    sections: SectionBlock[];
}

/** Matches a Supabase-style placeholder: `{{ .name }}`, whitespace optional. */
export const PLACEHOLDER = /\{\{\s*\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

/** Templates are client-authored free text; cap the size so a paste can't blow up a PDF render. */
export const MAX_TEMPLATE_LENGTH = 20_000;
