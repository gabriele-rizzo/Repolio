import { parseTemplate, substitute } from "@/lib/report/template/parse";
import { DEFAULT_TEMPLATE_BODY, TEMPLATE_PRESETS } from "@/lib/report/template/presets";
import { SECTION_BLOCKS } from "@/lib/report/template/types";
import { SCALAR_VARIABLE_NAMES } from "@/lib/report/template/variables";
import { describe, expect, it } from "vitest";

describe("parseTemplate", () => {
    it("reports an empty template rather than throwing", () => {
        const { blocks, issues } = parseTemplate("   \n  \n");
        expect(blocks).toEqual([]);
        expect(issues).toEqual([{ line: 1, kind: "empty", message: "The template is empty." }]);
    });

    it("parses the three heading levels", () => {
        const { blocks } = parseTemplate("# One\n## Two\n### Three");
        expect(blocks).toEqual([
            { kind: "heading", level: 1, text: "One" },
            { kind: "heading", level: 2, text: "Two" },
            { kind: "heading", level: 3, text: "Three" },
        ]);
    });

    it("parses notes and dividers", () => {
        const { blocks } = parseTemplate("> a note\n---");
        expect(blocks).toEqual([{ kind: "note", text: "a note" }, { kind: "divider" }]);
    });

    it("keeps consecutive lines in one paragraph and splits on a blank line", () => {
        const { blocks } = parseTemplate("first line\nsecond line\n\nnew paragraph");
        expect(blocks).toEqual([
            { kind: "paragraph", text: "first line\nsecond line" },
            { kind: "paragraph", text: "new paragraph" },
        ]);
    });

    it("recognises a section block alone on its line", () => {
        const { blocks, sections } = parseTemplate("{{ .metricsTable }}");
        expect(blocks).toEqual([{ kind: "section", section: "metricsTable" }]);
        expect(sections).toEqual(["metricsTable"]);
    });

    it("accepts a section placeholder without inner spaces", () => {
        expect(parseTemplate("{{.recommendations}}").blocks).toEqual([
            { kind: "section", section: "recommendations" },
        ]);
    });

    it("flags a section used inline, where it cannot expand", () => {
        const { blocks, issues } = parseTemplate("Summary: {{ .executiveSummary }} — done");
        expect(blocks[0].kind).toBe("paragraph");
        expect(issues).toHaveLength(1);
        expect(issues[0].kind).toBe("section-inline");
        expect(issues[0].line).toBe(1);
    });

    it("flags unknown variables with their line number", () => {
        const { issues } = parseTemplate("# Title\nSpend was {{ .revenu }} this period.");
        expect(issues).toEqual([
            { line: 2, kind: "unknown-variable", message: 'Unknown variable "{{ .revenu }}".' },
        ]);
    });

    it("flags an unknown variable alone on a line but still keeps the text", () => {
        const { blocks, issues } = parseTemplate("{{ .nope }}");
        expect(issues[0].kind).toBe("unknown-variable");
        expect(blocks).toEqual([{ kind: "paragraph", text: "{{ .nope }}" }]);
    });

    it("treats a scalar alone on a line as a paragraph, not an issue", () => {
        const { blocks, issues } = parseTemplate("{{ .spend }}");
        expect(issues).toEqual([]);
        expect(blocks).toEqual([{ kind: "paragraph", text: "{{ .spend }}" }]);
    });

    it("does not mistake a hash inside prose for a heading", () => {
        expect(parseTemplate("issue #42 was fixed").blocks).toEqual([
            { kind: "paragraph", text: "issue #42 was fixed" },
        ]);
    });

    it("normalises CRLF line endings", () => {
        const { blocks } = parseTemplate("# Title\r\n\r\nbody");
        expect(blocks).toEqual([
            { kind: "heading", level: 1, text: "Title" },
            { kind: "paragraph", text: "body" },
        ]);
    });

    it("collects each section only once in `sections`", () => {
        const { sections } = parseTemplate("{{ .metricsTable }}\n{{ .metricsTable }}");
        expect(sections).toEqual(["metricsTable"]);
    });
});

describe("built-in presets", () => {
    it.each(TEMPLATE_PRESETS.map((p) => [p.id, p] as const))("%s parses without issues", (_id, preset) => {
        const { issues, blocks } = parseTemplate(preset.body);
        expect(issues).toEqual([]);
        expect(blocks.length).toBeGreaterThan(0);
    });

    it("the default template uses every section block, so nothing is silently dropped", () => {
        const { sections } = parseTemplate(DEFAULT_TEMPLATE_BODY);
        expect([...sections].sort()).toEqual([...SECTION_BLOCKS].sort());
    });
});

describe("substitute", () => {
    const vars = { spend: "€12,480.55", accountName: "Cinemepic" };

    it("replaces known placeholders", () => {
        expect(substitute("{{ .accountName }} spent {{ .spend }}", vars)).toBe("Cinemepic spent €12,480.55");
    });

    it("tolerates missing inner spaces", () => {
        expect(substitute("{{.spend}}", vars)).toBe("€12,480.55");
    });

    it("leaves unknown placeholders verbatim so a typo is visible, not invisible", () => {
        expect(substitute("was {{ .revenu }}", vars)).toBe("was {{ .revenu }}");
    });

    it("replaces every occurrence", () => {
        expect(substitute("{{ .spend }} / {{ .spend }}", vars)).toBe("€12,480.55 / €12,480.55");
    });

    it("leaves text with no placeholders untouched", () => {
        expect(substitute("plain text", vars)).toBe("plain text");
    });

    it("does not treat a replacement value's $ as a regex group reference", () => {
        // "$&" in a replacement string would otherwise re-insert the whole match.
        expect(substitute("{{ .spend }}", { spend: "$& $1 $$" })).toBe("$& $1 $$");
    });
});

describe("variable catalogue", () => {
    it("has no duplicate names", () => {
        expect(new Set(SCALAR_VARIABLE_NAMES).size).toBe(SCALAR_VARIABLE_NAMES.length);
    });

    it("keeps section names and scalar names disjoint", () => {
        for (const section of SECTION_BLOCKS) expect(SCALAR_VARIABLE_NAMES).not.toContain(section);
    });
});
