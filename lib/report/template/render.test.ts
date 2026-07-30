import type { Translator } from "@/lib/metrics/present";
import { TEMPLATE_PRESETS } from "@/lib/report/template/presets";
import { checkTemplate, renderTemplate, wrapDocument } from "@/lib/report/template/render";
import { sanitizeTemplate } from "@/lib/report/template/sanitize";
import { SCALAR_VARIABLE_NAMES } from "@/lib/report/template/variables";
import type { SectionData } from "@/lib/report/template/sections";
import { describe, expect, it } from "vitest";

const t: Translator = (key) => key;

const sections: SectionData = {
    score: 78,
    scoreLabel: "STRONG",
    kpis: [
        { key: "spend", label: "Spend", betterWhen: "neutral", value: "€12,480.55", delta: { percent: "23%", direction: "up", good: null } },
        { key: "roas", label: "ROAS", betterWhen: "up", value: "3.30x", delta: null },
    ],
    executiveSummary: "First paragraph.\n\nSecond paragraph.",
    recommendations: [{ priority: "IMMEDIATE", category: "BUDGET", title: "Do the thing", body: "Because of the data." }],
    trendExplanation: "Improving.",
    contextComment: null,
    t,
    deltaStyle: "arrow",
};

// Every declared scalar gets a value, so an unresolved `{{` in the output means a real gap rather
// than a hole in the fixture.
const variables = Object.fromEntries(SCALAR_VARIABLE_NAMES.map((name) => [name, `<${name}>`]));
Object.assign(variables, { accountName: "Cinemepic", spend: "€12,480.55" });

const render = (body: string, over: Partial<SectionData> = {}) =>
    renderTemplate({ body, variables, sections: { ...sections, ...over } });

describe("sanitizeTemplate", () => {
    it("keeps layout markup, classes and inline styles", () => {
        const html = '<div class="a" style="color:red"><p>hi</p></div>';
        expect(sanitizeTemplate(html).html).toContain('class="a"');
        expect(sanitizeTemplate(html).html).toContain('style="color:red"');
    });

    it("keeps <style> blocks, which are how a template does its own design", () => {
        const { html, changed } = sanitizeTemplate("<style>.x { color: red }</style><div class='x'>hi</div>");
        expect(html).toContain(".x { color: red }");
        expect(changed).toBe(false);
    });

    it("removes script tags and their contents", () => {
        const { html, changed } = sanitizeTemplate("<p>ok</p><script>alert(1)</script>");
        expect(html).not.toContain("script");
        expect(html).not.toContain("alert");
        expect(html).toContain("ok");
        expect(changed).toBe(true);
    });

    it("removes event handler attributes", () => {
        const { html } = sanitizeTemplate('<div onclick="alert(1)" onerror="x()">hi</div>');
        expect(html).not.toContain("onclick");
        expect(html).not.toContain("onerror");
        expect(html).toContain("hi");
    });

    it("removes iframes, objects and embeds", () => {
        for (const tag of ["iframe", "object", "embed"]) {
            const { html } = sanitizeTemplate(`<${tag} src="https://evil.test"></${tag}>`);
            expect(html).not.toContain(tag);
        }
    });

    it("strips javascript: links", () => {
        const { html } = sanitizeTemplate('<a href="javascript:alert(1)">x</a>');
        expect(html).not.toContain("javascript:");
    });

    it("keeps ordinary links", () => {
        expect(sanitizeTemplate('<a href="https://example.com">x</a>').html).toContain("https://example.com");
    });

    it("blocks remote images but keeps data: URIs", () => {
        expect(sanitizeTemplate('<img src="https://evil.test/px.gif" />').html).not.toContain("evil.test");
        expect(sanitizeTemplate('<img src="data:image/png;base64,AAA" />').html).toContain("data:image/png");
    });

    it("reports no change for markup it leaves alone", () => {
        expect(sanitizeTemplate("<div><p>hello</p></div>").changed).toBe(false);
    });
});

describe("renderTemplate", () => {
    it("substitutes scalar placeholders", () => {
        expect(render("<h1>{{ .accountName }}</h1>")).toContain("<h1>Cinemepic</h1>");
    });

    it("escapes substituted values, so data can't inject markup", () => {
        const out = renderTemplate({
            body: "<p>{{ .accountName }}</p>",
            variables: { accountName: '<img src=x onerror="alert(1)">' },
            sections,
        });

        expect(out).not.toContain("<img");
        expect(out).toContain("&lt;img");
    });

    it("leaves unknown placeholders verbatim so a typo stays visible", () => {
        expect(render("<p>{{ .revenu }}</p>")).toContain("{{ .revenu }}");
    });

    it("expands section placeholders into markup", () => {
        const out = render("<div>{{ .recommendations }}</div>");
        expect(out).toContain("Do the thing");
        expect(out).toContain("Because of the data.");
    });

    it("splits AI prose on blank lines into paragraphs", () => {
        const out = render("{{ .executiveSummary }}");
        expect(out).toContain("First paragraph.");
        expect(out).toContain("Second paragraph.");
        expect(out.match(/<p class="rp-p">/g)?.length).toBe(2);
    });

    it("escapes AI prose, which is model output rather than trusted markup", () => {
        const out = render("{{ .trendExplanation }}", { trendExplanation: "<b>bold</b>" });
        expect(out).not.toContain("<b>bold</b>");
        expect(out).toContain("&lt;b&gt;");
    });

    /** Sanitizing after substitution would strip our own section markup; this pins the order. */
    it("does not sanitize away the section fragments it just inserted", () => {
        const out = render("{{ .scoreCard }}");
        expect(out).toContain('class="rp-card"');
        expect(out).toContain("78");
    });

    it("strips scripts from the template but still renders the rest", () => {
        const out = render("<script>alert(1)</script><h1>{{ .accountName }}</h1>");
        expect(out).not.toContain("alert(1)");
        expect(out).toContain("Cinemepic");
    });

    it("drops an empty context section together with the heading above it", () => {
        const out = render("<div>keep</div><h3>Context</h3>{{ .contextComment }}", { contextComment: null });
        expect(out).not.toContain("Context");
        expect(out).toContain("keep");
    });

    it("keeps the heading when the context section has content", () => {
        const out = render("<h3>Context</h3>{{ .contextComment }}", { contextComment: "Paused DACH." });
        expect(out).toContain("Context");
        expect(out).toContain("Paused DACH.");
    });

    it("falls back to the default preset when the body is blank", () => {
        expect(render("   ").length).toBeGreaterThan(200);
        expect(render("")).toContain("rp-");
    });

    it("prepends the section stylesheet so templates can override it", () => {
        const out = render("<p>x</p>");
        expect(out.indexOf(".rp-card")).toBeLessThan(out.indexOf("<p>x</p>"));
    });
});

describe("wrapDocument", () => {
    it("produces a standalone document with an escaped title", () => {
        const doc = wrapDocument("<p>hi</p>", { title: '<script>x</script>', locale: "en" });
        expect(doc.startsWith("<!DOCTYPE html>")).toBe(true);
        expect(doc).toContain('lang="en"');
        expect(doc).not.toContain("<script>x</script>");
        expect(doc).toContain("<p>hi</p>");
    });
});

describe("checkTemplate", () => {
    it("flags unknown variables once each", () => {
        const issues = checkTemplate("<p>{{ .revenu }} {{ .revenu }}</p>");
        expect(issues.filter((i) => i.kind === "unknown-variable")).toHaveLength(1);
    });

    it("accepts known scalars and sections", () => {
        expect(checkTemplate("<p>{{ .spend }}</p>{{ .metricsTable }}")).toEqual([]);
    });

    it("warns when markup will be stripped", () => {
        const issues = checkTemplate("<script>alert(1)</script>");
        expect(issues.some((i) => i.kind === "stripped-markup")).toBe(true);
    });

    it("warns about CSS the PDF cannot honour, which is otherwise silent", () => {
        for (const css of ["display: grid", "float: left", "@media print { }", "box-shadow: 0 0 2px #000"]) {
            const issues = checkTemplate(`<style>.a { ${css} }</style><p>x</p>`);
            expect(issues.some((i) => i.kind === "unsupported-pdf-css"), css).toBe(true);
        }
    });

    it("does not warn about CSS the PDF does support", () => {
        const issues = checkTemplate("<style>.a { display: flex; border: 1px solid #eee; color: red }</style><p>x</p>");
        expect(issues).toEqual([]);
    });

    it("reports an empty template rather than throwing", () => {
        expect(checkTemplate("  ")).toEqual([
            { kind: "empty", message: "The template is empty — the built-in default will be used." },
        ]);
    });
});

describe("built-in presets", () => {
    it.each(TEMPLATE_PRESETS.map((p) => [p.id, p] as const))("%s has no issues", (_id, preset) => {
        expect(checkTemplate(preset.body)).toEqual([]);
    });

    it.each(TEMPLATE_PRESETS.map((p) => [p.id, p] as const))("%s renders", (_id, preset) => {
        const out = render(preset.body);
        expect(out).toContain("Cinemepic");
        expect(out).not.toContain("{{");
    });
});

describe("unsupported-CSS detection precision", () => {
    /**
     * `text-transform` and `backdrop-filter` contain "transform" and "filter" after a hyphen, and a \b
     * word boundary matches there — which flagged text-transform (fully supported by the PDF) in every
     * preset. A false warning teaches people to ignore the warnings.
     */
    it("does not flag hyphenated properties that merely contain a keyword", () => {
        const issues = checkTemplate("<style>.a { text-transform: uppercase }</style><p>x</p>");
        expect(issues).toEqual([]);
    });

    it("still flags the standalone properties", () => {
        expect(checkTemplate("<style>.a { transform: rotate(2deg) }</style>").some((i) => i.kind === "unsupported-pdf-css")).toBe(true);
        expect(checkTemplate("<style>.a { filter: blur(2px) }</style>").some((i) => i.kind === "unsupported-pdf-css")).toBe(true);
    });
});
