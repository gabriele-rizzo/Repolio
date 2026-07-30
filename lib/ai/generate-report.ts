import type { Recommendation } from "@/components/report/recommendation-card";
import type { Report, Snapshot } from "@/generated/prisma/browser";
import type { Prisma } from "@/generated/prisma/client";
import { getAnthropic } from "@/lib/ai/anthropic";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/request";
import { computeMetrics, type ComputedMetrics } from "@/lib/metrics/compute";
import { prisma } from "@/lib/prisma";
import { RELEASED_REPORT } from "@/lib/report/visibility";
import type Anthropic from "@anthropic-ai/sdk";

// Report language sent to the model. Keyed by the client's stored locale.
const LANGUAGE_NAMES: Record<Locale, string> = { de: "German", en: "English", it: "Italian" };

// Sonnet 5: structured outputs (output_config.format, used below) are not supported on Sonnet 4.6,
// so a batch request on 4.6 errored and the report rendered with empty AI sections. Sonnet 5 keeps
// the same request surface we use here (adaptive thinking, effort, json_schema format).
const MODEL = "claude-sonnet-5";
// How many prior reports for the same ad account to feed in as trend context.
const HISTORY_DEPTH = 3;

type ReportWithSnapshots = Report & { snapshots: Snapshot[] };

interface GeneratedReport {
    executive_summary: string;
    trend_explanation: string;
    recommendations: Recommendation[];
}

const PRIORITIES = ["IMMEDIATE", "THIS_WEEK", "MONITOR"] as const;
const CATEGORIES = ["BUDGET", "CREATIVE", "TARGETING", "BIDDING"] as const;

// Mirrors the `Recommendation` shape the report UI renders. Enums are enforced
// server-side by structured outputs, so the model can only emit valid values.
const REPORT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        executive_summary: {
            type: "string",
            description: "2-4 short paragraphs of client-facing prose. Lead with the headline.",
        },
        trend_explanation: {
            type: "string",
            description: "1-2 paragraphs on the account's trajectory and its drivers.",
        },
        recommendations: {
            type: "array",
            description: "2-5 concrete, data-backed recommendations.",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    priority: { type: "string", enum: [...PRIORITIES] },
                    category: { type: "string", enum: [...CATEGORIES] },
                    title: { type: "string", description: "Short imperative headline." },
                    body: { type: "string", description: "1-3 sentences justifying the action with the data." },
                },
                required: ["priority", "category", "title", "body"],
            },
        },
    },
    required: ["executive_summary", "trend_explanation", "recommendations"],
};

const SYSTEM_PROMPT = `You are a senior performance-marketing analyst at a digital ads agency. You write the AI-generated section of a client's recurring performance report for a single ad account.

You are given:
- METRICS FOR THE CURRENT PERIOD: KPIs aggregated from the account's ad platform data.
- The LAST UP TO 3 REPORTS for the same account, if any exist yet (most recent first): each with its period, its KPIs, and the narrative + recommendations written at the time.
- Optionally, CLIENT TARGETS (target CPA / target ROAS) and a CONTEXT NOTE from the account manager.

Produce three things. Where previous reports are provided, ground them in how performance has TRENDED across those reports rather than the current period in isolation:

1. executive_summary — 2-4 short paragraphs of plain prose addressed to the client. Explain how the account performed this period and what it means in business terms; where previous reports are provided, also explain what changed versus them. Lead with the headline and be specific with the numbers provided.

2. trend_explanation — 1-2 paragraphs on the trajectory (improving, declining, volatile, flat) and the most likely drivers, referencing the metric movements. When prior reports are available, read the trajectory across them. When they are not, characterise the account's current trajectory from the shape of the current period itself — the mix of spend, efficiency and volume, and performance against targets — and state that read directly.

3. recommendations — 2-5 concrete, actionable recommendations. Each has:
   - priority: IMMEDIATE (act now — performance at risk or a clear opportunity), THIS_WEEK (important, not urgent), or MONITOR (watch, no action yet).
   - category: BUDGET, CREATIVE, TARGETING, or BIDDING.
   - title: a short imperative headline.
   - body: 1-3 sentences justifying the action with the data.

Rules:
- Use ONLY the metrics provided. Never invent numbers, campaign names, or facts not in the input. If a metric is "n/a", do not guess it.
- Revenue and ROAS count purchase conversions only. Lead-generation accounts legitimately show "n/a" there — never treat a missing ROAS as underperformance; judge such accounts on Leads and CPL.
- Conversions = purchases + leads; the breakdown is provided. CTR and CPC are computed on link clicks when available.
- Metric blocks of previous reports are recomputed with the current methodology, so their narrative text may cite figures that no longer match. Where a previous narrative and the numbers disagree, trust the numbers.
- When targets are provided, judge performance against them (CPA above target is bad; ROAS above target is good).
- Be honest about weak performance and acknowledge genuine improvement; avoid generic marketing platitudes. Every sentence should say something specific.
- Never comment on the reporting history itself. Do not mention that this is a first or early report, how many prior reports you were given, that history is limited or absent, or that a later report will be more accurate. Do not hedge the analysis on the amount of history available, and do not promise what future reports will cover. Analyse whatever data you were given at full confidence, with no meta-commentary about the inputs.
- Cover only what the data supports. If a question cannot be answered from the metrics provided, leave it out — do not substitute a proxy topic, a generic best practice, or a speculative angle to fill space. Fewer, well-grounded points beat padded ones.
- Currency amounts are in the account's own currency — do not assume a symbol.
- Write in clear, professional prose, in the target language specified at the end of the request.`;

const dateOnly = (d: Date | string): string => new Date(d).toISOString().slice(0, 10);

const fmtNum = (v: number | null | undefined, digits = 2): string =>
    v == null ? "n/a" : v.toLocaleString("en-US", { maximumFractionDigits: digits });

function isRecommendation(v: unknown): v is Recommendation {
    if (typeof v !== "object" || v === null) return false;
    const r = v as Record<string, unknown>;
    return (
        typeof r.title === "string" &&
        typeof r.body === "string" &&
        typeof r.priority === "string" &&
        (PRIORITIES as readonly string[]).includes(r.priority) &&
        typeof r.category === "string" &&
        (CATEGORIES as readonly string[]).includes(r.category)
    );
}

function periodLine(report: ReportWithSnapshots): string {
    const generated = dateOnly(report.created_at);
    const times = report.snapshots.map((s) => new Date(s.start_date).getTime()).filter(Number.isFinite);
    if (times.length === 0) return `Generated ${generated}. No snapshots attached.`;
    const from = dateOnly(new Date(Math.min(...times)));
    const to = dateOnly(new Date(Math.max(...times)));
    const n = report.snapshots.length;
    return `Period covered: ${from} → ${to} (${n} snapshot${n === 1 ? "" : "s"}). Generated ${generated}.`;
}

function formatMetrics(m: ComputedMetrics | null): string {
    if (!m) return "No metrics available for this period.";
    return [
        `- Currency: ${m.currency}`,
        `- Spend: ${fmtNum(m.spend)}`,
        `- Revenue (purchase-attributed): ${fmtNum(m.revenue)}`,
        `- ROAS: ${fmtNum(m.roas)}`,
        `- Conversions: ${fmtNum(m.conversions, 0)} (${fmtNum(m.purchases, 0)} purchases + ${fmtNum(m.leads, 0)} leads)`,
        `- CPA: ${fmtNum(m.cpa)}`,
        `- CPL: ${fmtNum(m.cpl)}`,
        `- CPC: ${fmtNum(m.cpc)}`,
        `- CTR: ${m.ctr == null ? "n/a" : `${fmtNum(m.ctr)}%`}`,
        `- CPM: ${fmtNum(m.cpm)}`,
        `- Impressions: ${fmtNum(m.impressions, 0)}`,
        `- Clicks (all): ${fmtNum(m.clicks, 0)}`,
        `- Link clicks: ${fmtNum(m.linkClicks, 0)}`,
        `- Reach: ${fmtNum(m.reach, 0)}`,
        `- Frequency: ${fmtNum(m.frequency)}`,
        `- Performance score: ${fmtNum(m.performance_score, 0)} (${m.score_label})`,
        // The score is a weighted blend; give the model the parts so it can explain the number
        // instead of guessing at it.
        ...m.score_components.map((c) => `  - ${c.label}: ${c.score}/100 (weight ${c.weight}) — ${c.detail}`),
    ].join("\n");
}

function formatPriorRecommendations(value: unknown): string | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    const lines = value.filter(isRecommendation).map((r) => `- [${r.priority}/${r.category}] ${r.title}`);
    return lines.length > 0 ? `Recommendations made at the time:\n${lines.join("\n")}` : null;
}

function buildUserPrompt(current: ReportWithSnapshots, priors: ReportWithSnapshots[], languageName: string): string {
    const parts: string[] = [
        "# CURRENT PERIOD",
        periodLine(current),
        formatMetrics(computeMetrics(current.snapshots)),
    ];

    const targets: string[] = [];
    if (current.target_cpa != null) targets.push(`Target CPA: ${fmtNum(current.target_cpa)}`);
    if (current.target_roas != null) targets.push(`Target ROAS: ${fmtNum(current.target_roas)}`);
    if (targets.length > 0) parts.push(`## CLIENT TARGETS\n${targets.join("\n")}`);
    if (current.context_comment) parts.push(`## CONTEXT NOTE FROM ACCOUNT MANAGER\n${current.context_comment}`);

    parts.push("# PREVIOUS REPORTS (most recent first)");
    if (priors.length === 0) {
        parts.push(
            "None available. Analyse the current period on its own terms, and do not refer to the absence of previous reports anywhere in the output.",
        );
    } else {
        priors.forEach((r, i) => {
            const block = [
                `## Report ${i + 1} — ${dateOnly(r.created_at)}`,
                periodLine(r),
                formatMetrics(computeMetrics(r.snapshots)),
                r.executive_summary ? `Executive summary at the time:\n${r.executive_summary}` : null,
                r.trend_explanation ? `Trend explanation at the time:\n${r.trend_explanation}` : null,
                formatPriorRecommendations(r.recommendations),
            ]
                .filter((x): x is string => Boolean(x))
                .join("\n");
            parts.push(block);
        });
    }

    parts.push(
        `Write the entire report — executive_summary, trend_explanation and every recommendation — in ${languageName}.`,
    );
    parts.push("Produce the report as JSON matching the required schema.");
    return parts.join("\n\n");
}

function parseGenerated(message: Anthropic.Message): GeneratedReport {
    const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) throw new Error("Model response contained no text block");

    let data: unknown;
    try {
        data = JSON.parse(textBlock.text);
    } catch {
        throw new Error("Model response was not valid JSON");
    }

    if (typeof data !== "object" || data === null) throw new Error("Model response was not an object");
    const obj = data as Record<string, unknown>;
    if (
        typeof obj.executive_summary !== "string" ||
        typeof obj.trend_explanation !== "string" ||
        !Array.isArray(obj.recommendations)
    ) {
        throw new Error("Model response missing required fields");
    }

    return {
        executive_summary: obj.executive_summary,
        trend_explanation: obj.trend_explanation,
        recommendations: obj.recommendations.filter(isRecommendation),
    };
}

/**
 * Builds the Messages API params for a report's AI section from the account's current snapshots and
 * its last {@link HISTORY_DEPTH} reports. No API call — this is shared by the live path
 * ({@link generateReportContent}) and the batch path (the poll cron), so both send identical prompts
 * and share the cached system prefix. Throws if the report is missing or has no snapshots.
 */
export async function buildReportParams(reportId: number): Promise<Anthropic.MessageCreateParamsNonStreaming> {
    const report = await prisma.report.findUnique({ where: { id: reportId }, include: { snapshots: true } });
    if (!report) throw new Error(`Report ${reportId} not found`);

    // Reports are one-per-ad-account, so any snapshot resolves the account.
    const adAccountId = report.snapshots[0]?.ad_account_id;
    if (adAccountId == null) throw new Error(`Report ${reportId} has no snapshots to base the report on`);

    // The report is written in the owning client's saved language.
    const adAccount = await prisma.adAccount.findUnique({
        where: { id: adAccountId },
        select: { connection: { select: { client: { select: { locale: true } } } } },
    });
    const locale = isLocale(adAccount?.connection.client.locale) ? adAccount.connection.client.locale : DEFAULT_LOCALE;

    // Released reports only. An unvalidated or admin-excluded report was never delivered, so letting
    // it into the history would let a new report reference a narrative the client never received.
    const priorReports = await prisma.report.findMany({
        where: { id: { not: reportId }, snapshots: { some: { ad_account_id: adAccountId } }, ...RELEASED_REPORT },
        orderBy: { created_at: "desc" },
        take: HISTORY_DEPTH,
        include: { snapshots: true },
    });

    return {
        model: MODEL,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        // Stable prefix → cached across the many reports generated in one run/batch.
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: REPORT_SCHEMA } },
        messages: [{ role: "user", content: buildUserPrompt(report, priorReports, LANGUAGE_NAMES[locale]) }],
    };
}

/** Parses a model response and writes the AI section back to the report row. */
export async function applyGeneratedReport(reportId: number, message: Anthropic.Message): Promise<void> {
    const generated = parseGenerated(message);

    await prisma.report.update({
        where: { id: reportId },
        data: {
            executive_summary: generated.executive_summary,
            trend_explanation: generated.trend_explanation,
            recommendations: generated.recommendations as unknown as Prisma.InputJsonValue,
        },
    });
}

/**
 * Generates the AI section of a report with a live (synchronous) Messages API call and writes it
 * back. The poll cron uses the cheaper Batches API instead; this remains for one-off/manual
 * regeneration. Throws on failure; callers decide whether that's fatal.
 */
export async function generateReportContent(reportId: number): Promise<void> {
    const message = await getAnthropic().messages.create(await buildReportParams(reportId));
    await applyGeneratedReport(reportId, message);
}
