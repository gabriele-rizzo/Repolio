import { sanitizeTemplate } from "@/lib/report/template/sanitize";
import { escapeHtml, renderSection, SECTION_STYLESHEET, type SectionData } from "@/lib/report/template/sections";
import { DEFAULT_TEMPLATE_BODY } from "@/lib/report/template/presets";
import {
    isRetiredSectionBlock,
    isSectionBlock,
    PLACEHOLDER,
    UNSUPPORTED_PDF_CSS,
    type TemplateIssue,
} from "@/lib/report/template/types";
import { SCALAR_VARIABLE_NAMES } from "@/lib/report/template/variables";

/**
 * Turns a template into the final document markup.
 *
 * ORDER IS THE SECURITY PROPERTY. The client's HTML is sanitized first, then placeholders are
 * substituted:
 *   - sanitizing *after* substitution would strip our own trusted section fragments;
 *   - substituting *before* sanitizing would let a client smuggle markup in through a value, since the
 *     value would then be parsed as part of the document.
 * Scalar values are HTML-escaped on the way in; section fragments are trusted markup we generated.
 */

export interface RenderTemplateInput {
    /** The template source. Falls back to the built-in preset when blank. */
    body: string | null | undefined;
    variables: Record<string, string>;
    sections: SectionData;
}

/**
 * A heading immediately followed by an empty section is dropped along with it.
 *
 * Without this, a template ending "<h3>Context</h3>{{ .contextComment }}" prints a lone heading above
 * blank space on every report with no context note — which is most of them. Only fires when the section
 * resolved to nothing and a heading sits directly before the placeholder.
 */
function dropOrphanHeading(html: string, placeholder: string): string {
    const pattern = new RegExp(
        `<(h[1-6]|p|div)([^>]*)>\\s*[^<]*\\s*</\\1>\\s*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "gi",
    );
    return html.replace(pattern, "");
}

export function renderTemplate({ body, variables, sections }: RenderTemplateInput): string {
    // A blank template must never produce a blank report.
    const source = body?.trim() ? body : DEFAULT_TEMPLATE_BODY;

    const { html: clean } = sanitizeTemplate(source);

    // Sections first: an empty one may take a preceding heading with it, which has to happen before the
    // markup is otherwise rewritten.
    let out = clean;
    for (const match of [...clean.matchAll(PLACEHOLDER)]) {
        const name = match[1];
        if (!isSectionBlock(name)) continue;

        const fragment = renderSection(name, sections);
        if (fragment === "") out = dropOrphanHeading(out, match[0]);
        out = out.split(match[0]).join(fragment);
    }

    // Then scalars. Unknown names are left verbatim so a typo is visible in the output rather than
    // silently deleted — the editor flags them before it ships.
    out = out.replace(PLACEHOLDER, (whole, name: string) =>
        variables[name] != null ? escapeHtml(variables[name]) : whole,
    );

    return `<style>${SECTION_STYLESHEET}</style>\n${out}`;
}

/**
 * Colours a template declares for the page itself.
 *
 * A dark design can't just style its own elements: the PDF's page is painted by react-pdf (a `Page`
 * style, not CSS), and the standalone HTML has a `body` background — neither is reachable from inside
 * the template. So a template opts in by declaring `--rp-page-bg` / `--rp-page-fg` in its CSS, and both
 * renderers read them from here. Extracted with a regex rather than a CSS parser: it's two documented
 * custom properties, not a general cascade.
 */
export interface PageColours {
    background: string;
    foreground: string;
}

const DEFAULT_PAGE_COLOURS: PageColours = { background: "#fafafa", foreground: "#0a0a0a" };

/** Only literal colours — no `var()`, no expressions — so nothing unresolvable reaches react-pdf. */
const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|[a-z]+)$/i;

export function pageColours(body: string | null | undefined): PageColours {
    const source = body?.trim() ? body : DEFAULT_TEMPLATE_BODY;

    const read = (name: string, fallback: string) => {
        const match = new RegExp(`--rp-page-${name}\\s*:\\s*([^;}]+)`, "i").exec(source);
        const value = match?.[1].trim();
        return value && COLOUR.test(value) ? value : fallback;
    };

    return {
        background: read("bg", DEFAULT_PAGE_COLOURS.background),
        foreground: read("fg", DEFAULT_PAGE_COLOURS.foreground),
    };
}

/** Wraps rendered body markup in a standalone HTML document. */
export function wrapDocument(
    bodyHtml: string,
    { title, locale, colours = DEFAULT_PAGE_COLOURS }: { title: string; locale: string; colours?: PageColours },
): string {
    return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 24px 16px; background: ${colours.background}; color: ${colours.foreground};
         font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* overflow-wrap: a long unbroken value (an ad account named without spaces) breaks rather than
     widening the document past its column, matching how the PDF renderer breaks it. */
  .rp-doc { max-width: 720px; margin: 0 auto; overflow-wrap: break-word; }
</style>
</head>
<body><div class="rp-doc">${bodyHtml}</div></body>
</html>`;
}

/**
 * Checks a template without rendering it: unknown placeholders, markup the sanitizer will remove, and
 * CSS the PDF cannot honour.
 *
 * Advisory only — nothing here blocks a save. The renderer degrades on every one of these, and refusing
 * to store half-finished work is worse than a warning.
 */
export function checkTemplate(body: string): TemplateIssue[] {
    const issues: TemplateIssue[] = [];

    if (body.trim().length === 0) {
        return [{ kind: "empty", message: "The template is empty — the built-in default will be used." }];
    }

    const unknown = new Set<string>();
    const retired = new Set<string>();
    for (const match of body.matchAll(PLACEHOLDER)) {
        const name = match[1];
        if (isRetiredSectionBlock(name)) retired.add(name);
        else if (!isSectionBlock(name) && !SCALAR_VARIABLE_NAMES.includes(name)) unknown.add(name);
    }
    for (const name of unknown) {
        issues.push({ kind: "unknown-variable", message: `Unknown variable "{{ .${name} }}" — it will print as-is.` });
    }
    for (const name of retired) {
        issues.push({
            kind: "retired-section",
            message: `"{{ .${name} }}" no longer exists — it renders as nothing, along with any heading directly above it. You can delete it.`,
        });
    }

    const stripped = sanitizeTemplate(body).stripped;
    if (stripped.length > 0) {
        issues.push({
            kind: "stripped-markup",
            message: `Removed for safety: ${stripped.map((s) => s.label).join(", ")}. Everything else is kept.`,
        });
    }

    for (const { pattern, label, advice } of UNSUPPORTED_PDF_CSS) {
        if (pattern.test(body)) {
            issues.push({
                kind: "unsupported-pdf-css",
                message: `"${label}" works in the preview but not in the attached PDF — ${advice}.`,
            });
        }
    }

    return issues;
}
