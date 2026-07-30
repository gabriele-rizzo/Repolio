import { SCALAR_VARIABLE_NAMES } from "@/lib/report/template/variables";
import {
    isSectionBlock,
    PLACEHOLDER,
    type ParsedTemplate,
    type SectionBlock,
    type TemplateBlock,
    type TemplateIssue,
} from "@/lib/report/template/types";

/**
 * Parses a report template into renderable blocks, plus the issues an editor should surface.
 *
 * Never throws and never rejects a template: an unparseable line is just a paragraph, and an unknown
 * placeholder is reported as an issue while being left verbatim in the output. A broken template must
 * degrade to a slightly wrong-looking report, not a failed send — this runs inside the batch delivery
 * path, where throwing would block a client's whole email.
 */
export function parseTemplate(source: string): ParsedTemplate {
    const blocks: TemplateBlock[] = [];
    const issues: TemplateIssue[] = [];
    const sections: SectionBlock[] = [];

    if (source.trim().length === 0) {
        return { blocks, issues: [{ line: 1, kind: "empty", message: "The template is empty." }], sections };
    }

    const lines = source.replace(/\r\n?/g, "\n").split("\n");

    // Consecutive text lines accumulate into one paragraph; a blank line or any structural line ends it.
    let paragraph: string[] = [];

    const flush = () => {
        if (paragraph.length === 0) return;
        blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
        paragraph = [];
    };

    lines.forEach((raw, index) => {
        const lineNo = index + 1;
        const line = raw.trim();

        if (line.length === 0) return flush();

        // A rich section block: the placeholder alone on its line.
        const sectionMatch = /^\{\{\s*\.([A-Za-z][A-Za-z0-9_]*)\s*\}\}$/.exec(line);
        if (sectionMatch) {
            const name = sectionMatch[1];

            if (isSectionBlock(name)) {
                flush();
                blocks.push({ kind: "section", section: name });
                if (!sections.includes(name)) sections.push(name);
                return;
            }

            // A scalar alone on a line is legal (it becomes a one-value paragraph), but an unknown name
            // is worth flagging here rather than letting it print as literal braces.
            if (!SCALAR_VARIABLE_NAMES.includes(name)) {
                issues.push({
                    line: lineNo,
                    kind: "unknown-variable",
                    message: `Unknown variable "{{ .${name} }}".`,
                });
            }

            paragraph.push(line);
            return;
        }

        if (line === "---") {
            flush();
            blocks.push({ kind: "divider" });
            return;
        }

        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        if (heading) {
            flush();
            const level = heading[1].length as 1 | 2 | 3;
            blocks.push({ kind: "heading", level, text: heading[2].trim() });
            collectIssues(heading[2], lineNo, issues);
            return;
        }

        const note = /^>\s?(.*)$/.exec(line);
        if (note) {
            flush();
            blocks.push({ kind: "note", text: note[1].trim() });
            collectIssues(note[1], lineNo, issues);
            return;
        }

        paragraph.push(line);
        collectIssues(line, lineNo, issues);
    });

    flush();

    return { blocks, issues, sections };
}

/** Flags unknown inline placeholders, and section blocks used inline where they can't expand. */
function collectIssues(text: string, line: number, issues: TemplateIssue[]): void {
    for (const match of text.matchAll(PLACEHOLDER)) {
        const name = match[1];

        if (isSectionBlock(name)) {
            issues.push({
                line,
                kind: "section-inline",
                message: `"{{ .${name} }}" is a section — put it alone on its own line.`,
            });
            continue;
        }

        if (!SCALAR_VARIABLE_NAMES.includes(name)) {
            issues.push({ line, kind: "unknown-variable", message: `Unknown variable "{{ .${name} }}".` });
        }
    }
}

/**
 * Substitutes scalar placeholders into a line of template text.
 *
 * Unknown names are left exactly as written. That's deliberate: silently deleting them would make a
 * typo invisible in the delivered PDF, whereas a visible `{{ .revenu }}` is self-diagnosing — and the
 * editor already flags it before it ships.
 */
export function substitute(text: string, variables: Record<string, string>): string {
    return text.replace(PLACEHOLDER, (whole, name: string) => variables[name] ?? whole);
}
