/**
 * Built-in report templates.
 *
 * Presets live in code rather than the database: they need no migration to add, are always available
 * (a client with no template still gets a real report), and can't be deleted out from under a client.
 * Applying a preset COPIES its body onto the client or ad account — it does not link to it — so
 * editing a preset here never silently rewrites what an existing client already receives.
 *
 * DEFAULT reproduces the layout the PDF and report email had before templating existed, so a client
 * who never touches this page sees no change at all.
 */

export interface TemplatePreset {
    id: string;
    name: string;
    description: string;
    body: string;
}

const DEFAULT_BODY = `# {{ .accountName }}
> {{ .platform }} · {{ .period }}

{{ .scoreCard }}

### Metrics
{{ .metricsTable }}

### Executive summary
{{ .executiveSummary }}

### Recommendations
{{ .recommendations }}

### Trend explanation
{{ .trendExplanation }}

### Context
{{ .contextComment }}
`;

const EXEC_BODY = `# {{ .accountName }}
> {{ .period }} · prepared for {{ .clientName }}

{{ .scoreCard }}

### The headline
{{ .executiveSummary }}

### What we're doing about it
{{ .recommendations }}

---

### The numbers
{{ .metricsTable }}

> Spend {{ .spend }} ({{ .spendChange }}) · ROAS {{ .roas }} ({{ .roasChange }}) · CPA {{ .cpa }} ({{ .cpaChange }})
`;

const LEADGEN_BODY = `# {{ .accountName }}
> {{ .platform }} · {{ .period }}

## {{ .leads }} leads at {{ .cpl }} each

Lead volume moved {{ .leadsChange }} and cost per lead {{ .cplChange }} against the previous
{{ .days }} days, on {{ .spend }} of spend.

{{ .scoreCard }}

### Executive summary
{{ .executiveSummary }}

### Recommendations
{{ .recommendations }}

### Full metrics
{{ .metricsTable }}

### Trend explanation
{{ .trendExplanation }}
`;

const MINIMAL_BODY = `# {{ .accountName }}
> {{ .period }}

{{ .executiveSummary }}

{{ .metricsTable }}

{{ .recommendations }}
`;

export const TEMPLATE_PRESETS: TemplatePreset[] = [
    {
        id: "default",
        name: "Standard",
        description: "Every section, in the classic order. Matches the report as it looked before templates.",
        body: DEFAULT_BODY,
    },
    {
        id: "executive",
        name: "Executive",
        description: "Narrative first, numbers last — for stakeholders who read the summary and stop.",
        body: EXEC_BODY,
    },
    {
        id: "leadgen",
        name: "Lead generation",
        description: "Opens on leads and cost per lead instead of ROAS, for accounts with no purchases.",
        body: LEADGEN_BODY,
    },
    {
        id: "minimal",
        name: "Minimal",
        description: "Summary, metrics, recommendations. No headings, no score card.",
        body: MINIMAL_BODY,
    },
];

export const DEFAULT_TEMPLATE_ID = "default";

/** The template used when a client has never set one. */
export const DEFAULT_TEMPLATE_BODY = DEFAULT_BODY;

export function findPreset(id: string): TemplatePreset | undefined {
    return TEMPLATE_PRESETS.find((p) => p.id === id);
}
