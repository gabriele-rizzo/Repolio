import type { Recommendation } from "@/components/report/recommendation-card";
import type { ScoreLabel } from "@/generated/prisma/browser";
import type { ComputedMetrics } from "@/lib/metrics/compute";
import { metricColumns, type MetricColumn, type Translator } from "@/lib/metrics/present";
import { parseTemplate } from "@/lib/report/template/parse";
import { DEFAULT_TEMPLATE_BODY } from "@/lib/report/template/presets";
import type { SectionBlock, TemplateBlock } from "@/lib/report/template/types";
import { buildVariables, type DeltaStyle } from "@/lib/report/template/variables";

/**
 * One report, resolved into everything the two renderers need: the template's blocks, the substituted
 * scalar values, and the data behind each rich section.
 *
 * Both the PDF (`lib/email/report-pdf.tsx`) and the HTML render (`components/email/report-email.tsx`)
 * take this and only differ in how they draw each block — so a template change can never affect one
 * deliverable and not the other.
 */
export interface ReportDocument {
    blocks: TemplateBlock[];
    variables: Record<string, string>;
    sections: {
        score: number | null;
        scoreLabel: ScoreLabel | null;
        kpis: MetricColumn[];
        executiveSummary: string;
        recommendations: Recommendation[];
        trendExplanation: string;
        contextComment: string | null;
    };
    t: Translator;
    locale: string;
}

export interface BuildDocumentInput {
    /** The template source. Falls back to the built-in default when blank. */
    templateBody: string | null | undefined;
    accountName: string;
    platformLabel: string;
    clientName: string;
    company: string | null;
    period: string;
    periodStart: string;
    periodEnd: string;
    days: number;
    generatedOn: string;
    current: ComputedMetrics | null;
    previous: ComputedMetrics | null;
    executiveSummary: string;
    recommendations: Recommendation[];
    trendExplanation: string;
    contextComment: string | null;
    t: Translator;
    locale: string;
    /**
     * How `{{ .xChange }}` placeholders are spelled. Default "arrow" (▲ / ▼) suits HTML; the PDF MUST
     * pass "sign" because its built-in font cannot encode those glyphs.
     */
    deltaStyle?: DeltaStyle;
}

/**
 * Sections that disappear entirely when they have nothing to show, rather than rendering a "none"
 * placeholder — because for these, absence is the normal case rather than a gap worth reporting.
 */
const OPTIONAL_SECTIONS: SectionBlock[] = ["contextComment"];

/**
 * Drops optional sections with no content, and any heading that introduced only them.
 *
 * Without this, the default template's trailing "### Context / {{ .contextComment }}" would print a
 * lone "CONTEXT" heading above blank space on every report that has no context note — which is most of
 * them. A heading is only removed when the very next block is the section being dropped, so a heading
 * that also introduces prose survives.
 */
export function pruneEmptySections(blocks: TemplateBlock[], isEmpty: (section: SectionBlock) => boolean): TemplateBlock[] {
    const kept: TemplateBlock[] = [];

    for (const block of blocks) {
        if (block.kind === "section" && OPTIONAL_SECTIONS.includes(block.section) && isEmpty(block.section)) {
            const previous = kept.at(-1);
            if (previous?.kind === "heading") kept.pop();
            continue;
        }

        kept.push(block);
    }

    return kept;
}

export function buildReportDocument(input: BuildDocumentInput): ReportDocument {
    // A blank or whitespace-only template must never produce a blank report — fall back to the preset
    // that mirrors the pre-template layout.
    const source = input.templateBody?.trim() ? input.templateBody : DEFAULT_TEMPLATE_BODY;
    const { blocks } = parseTemplate(source);

    const scoreLabel = input.current?.score_label ?? null;

    const pruned = pruneEmptySections(blocks, (section) =>
        section === "contextComment" ? !input.contextComment?.trim() : false,
    );

    return {
        blocks: pruned,
        variables: buildVariables({
            accountName: input.accountName,
            platformLabel: input.platformLabel,
            clientName: input.clientName,
            company: input.company,
            period: input.period,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            days: input.days,
            generatedOn: input.generatedOn,
            current: input.current,
            previous: input.previous,
            scoreLabel: scoreLabel ? input.t(`score.${scoreLabel}`) : "—",
            deltaStyle: input.deltaStyle ?? "arrow",
        }),
        sections: {
            score: input.current?.performance_score ?? null,
            scoreLabel,
            kpis: metricColumns(input.current, input.previous, input.t),
            executiveSummary: input.executiveSummary,
            recommendations: input.recommendations,
            trendExplanation: input.trendExplanation,
            contextComment: input.contextComment,
        },
        t: input.t,
        locale: input.locale,
    };
}
