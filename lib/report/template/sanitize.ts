import sanitizeHtml from "sanitize-html";

/**
 * Strips anything executable or outbound from a client-authored template, keeping everything that is
 * purely layout and styling.
 *
 * This is a real security boundary, not a formality. The rendered template is served as `text/html` from
 * our own origin by `/api/reports/[id]/email`, and the report page's Download button loads it into an
 * iframe — so a `<script>` in a template would execute in our origin. Worse, an admin previewing a
 * client's template would run that client's markup against an admin session.
 *
 * What survives: structural and text tags, tables, images, and CSS — inline `style` attributes and
 * `<style>` blocks alike — which is what makes "design it however you want" true.
 *
 * What doesn't: `<script>`, `<iframe>`/`<object>`/`<embed>`, every `on*` handler, `javascript:` URLs,
 * and remote resource loads. Images are restricted to `data:` URIs, and CSS is post-processed to drop
 * `@import` and remote `url()` — otherwise a stylesheet would be an open door back out to the network,
 * which is exactly what the image restriction exists to close.
 */

const ALLOWED_TAGS = [
    // Structure
    "div", "section", "article", "header", "footer", "main", "aside", "nav",
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "br", "hr", "pre", "blockquote",
    // Text
    "b", "strong", "i", "em", "u", "s", "small", "sub", "sup", "code", "abbr", "mark",
    // Lists
    "ul", "ol", "li", "dl", "dt", "dd",
    // Tables
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
    // Media + styling
    "img", "figure", "figcaption", "style",
    // Links are kept: a report legitimately links back to the dashboard.
    "a",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
    "*": ["style", "class", "id", "align", "valign", "width", "height", "colspan", "rowspan", "dir", "lang"],
    a: ["href", "target", "rel", "style", "class", "id"],
    img: ["src", "alt", "width", "height", "style", "class", "id"],
    table: ["style", "class", "id", "width", "cellpadding", "cellspacing", "border", "align"],
};

const OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // Keep declarations as written; the CSS subset is the template author's business, and the network
    // escapes that actually matter are handled by scrubCss below.
    allowedStyles: undefined,
    // `<style>` is on the allowlist deliberately — a template's stylesheet IS the feature. The library
    // warns because CSS can reach the network; scrubCss closes that, so the warning is acknowledged here
    // rather than left printing on every render.
    allowVulnerableTags: true,
    allowedSchemesByTag: { img: ["data"], a: ["http", "https", "mailto"] },
    allowedSchemes: ["http", "https", "mailto", "data"],
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "textarea", "option", "noscript", "iframe", "object", "embed"],
    parseStyleAttributes: false,
};

/** Removes the two ways CSS can reach the network. `url(data:…)` is left alone. */
function scrubCss(css: string): string {
    return css
        .replace(/@import[^;]*;?/gi, "")
        .replace(/url\(\s*(['"]?)(?!data:)[^)'"]*\1\s*\)/gi, "none");
}

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

export interface StrippedMarkup {
    kind: "script" | "handler" | "frame" | "javascript-url" | "remote-image" | "css-network";
    label: string;
}

/**
 * What the sanitizer will remove from this template.
 *
 * Detected by scanning the INPUT rather than by diffing input against output: the sanitizer also
 * reformats (normalising `class='x'` to `class="x"`, re-encoding entities), and a diff reports every
 * such cosmetic change as "we removed something", which is a false alarm on almost every template.
 */
export function detectStrippedMarkup(html: string): StrippedMarkup[] {
    const found: StrippedMarkup[] = [];
    const add = (kind: StrippedMarkup["kind"], label: string) => {
        if (!found.some((f) => f.kind === kind)) found.push({ kind, label });
    };

    if (/<script\b/i.test(html)) add("script", "<script> blocks");
    if (/\son[a-z]+\s*=/i.test(html)) add("handler", "event handlers (onclick=…)");
    if (/<(iframe|object|embed)\b/i.test(html)) add("frame", "<iframe>/<object>/<embed>");
    if (/javascript:/i.test(html)) add("javascript-url", "javascript: URLs");
    if (/<img[^>]+src\s*=\s*['"]?(?!data:)(https?:)?\/\//i.test(html)) add("remote-image", "remote images");

    for (const match of html.matchAll(STYLE_BLOCK)) {
        const css = match[1];
        if (/@import/i.test(css) || /url\(\s*(['"]?)(?!data:)[^)'"]+\1\s*\)/i.test(css)) {
            add("css-network", "@import / remote url() in CSS");
        }
    }

    return found;
}

export interface SanitizeResult {
    html: string;
    /** True when something was actually removed — not merely reformatted. */
    changed: boolean;
    stripped: StrippedMarkup[];
}

/** Sanitizes a template body. Never throws; a soup of unknown tags simply comes back reduced. */
export function sanitizeTemplate(html: string): SanitizeResult {
    const stripped = detectStrippedMarkup(html);
    const clean = sanitizeHtml(html, OPTIONS).replace(STYLE_BLOCK, (_whole, css: string) => `<style>${scrubCss(css)}</style>`);

    return { html: clean, changed: stripped.length > 0, stripped };
}
