import type { Prisma } from "@/generated/prisma/client";
import { getAnthropic } from "@/lib/ai/anthropic";
import {
    buildUserPrompt,
    isRecommendation,
    LANGUAGE_NAMES,
    REPORT_SCHEMA,
    SYSTEM_PROMPT,
    type GeneratedReport,
} from "@/lib/ai/report-prompt";
import { sanitizeGeneratedReport } from "@/lib/ai/sanitize";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { prisma } from "@/lib/prisma";
import { RELEASED_REPORT } from "@/lib/report/visibility";
import { logSyncError } from "@/lib/sync-error";
import type Anthropic from "@anthropic-ai/sdk";

// Orchestration of the AI report section: load what the prompt needs, submit it, write the result back.
// The prompt itself (system prompt, schema, user-prompt assembly) lives in lib/ai/report-prompt.ts.

// Sonnet 5: structured outputs (output_config.format, used below) are not supported on Sonnet 4.6,
// so a batch request on 4.6 errored and the report rendered with empty AI sections. Sonnet 5 keeps
// the same request surface we use here (adaptive thinking, effort, json_schema format).
const MODEL = "claude-sonnet-5";
// How many prior reports for the same ad account to feed in as trend context.
const HISTORY_DEPTH = 3;

// Generous on purpose. Adaptive thinking is billed against the same ceiling as the visible answer, so
// a tight budget leaves the model finishing a German narrative under pressure — which is when it
// starts rushing the close and derailing into the debris lib/ai/sanitize.ts exists to catch. The
// batch path has no HTTP timeout to respect, so there is nothing to buy by keeping this low.
const MAX_TOKENS = 16_000;

function parseGenerated(message: Anthropic.Message): GeneratedReport {
    // A response cut short at max_tokens, or declined, is not a report. Structured outputs can still
    // hand back parseable JSON in both cases, so the stop reason is the only honest signal that what
    // follows is a complete answer — and writing a half-written narrative to a client-facing row is
    // the failure this whole path is guarding against.
    if (message.stop_reason === "max_tokens") throw new Error("Model response was truncated at max_tokens");
    if (message.stop_reason === "refusal") throw new Error("Model declined to produce the report");

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
    if (typeof obj.trend_explanation !== "string" || !Array.isArray(obj.recommendations)) {
        throw new Error("Model response missing required fields");
    }

    return {
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

    // The report is written in the owning client's saved language, and framed by the account's standing
    // background. Read here, at prompt-build time, which is what makes the background actually reach the
    // model — unlike Report.context_comment, which the client writes after the report was generated.
    const adAccount = await prisma.adAccount.findUnique({
        where: { id: adAccountId },
        select: { context_note: true, connection: { select: { client: { select: { locale: true } } } } },
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
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        // Stable prefix → cached across the many reports generated in one run/batch.
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: REPORT_SCHEMA } },
        messages: [
            {
                role: "user",
                content: buildUserPrompt(report, priorReports, LANGUAGE_NAMES[locale], adAccount?.context_note ?? null),
            },
        ],
    };
}

/**
 * Parses a model response and writes the AI section back to the report row.
 *
 * Every string the model authored is scrubbed on the way in (see lib/ai/sanitize.ts): the schema
 * constrains the response's SHAPE, never what a string inside it says, so a valid-against-schema
 * response can still carry the model's own JSON-closing attempt and self-repair narration in a field
 * a client reads. This is the last point before that text becomes a row.
 *
 * `executive_summary` is deliberately not written: the summary was removed from every report surface,
 * so the model is no longer asked for one. The column stays (rows created before the change keep
 * their text, and nothing renders it) rather than forcing a migration on a live database.
 */
export async function applyGeneratedReport(reportId: number, message: Anthropic.Message): Promise<void> {
    const { report: generated, repaired } = sanitizeGeneratedReport(parseGenerated(message));

    // Nothing survived the scrub: the response was debris end to end. Throw rather than write, so the
    // report keeps whatever it had — a regeneration degrades to the previous text, not to an empty
    // section — and the caller records the failure like any other.
    if (!generated.trend_explanation && generated.recommendations.length === 0) {
        throw new Error("Model response was structurally damaged and left nothing usable");
    }

    await prisma.report.update({
        where: { id: reportId },
        data: {
            trend_explanation: generated.trend_explanation,
            recommendations: generated.recommendations as unknown as Prisma.InputJsonValue,
        },
    });

    // A partial scrub still delivers a report, so this is not a failure path — but it means a
    // generation half-derailed, and without a record the only witness is the client reading it.
    if (repaired) {
        await logSyncError({
            stage: "ai_output_repaired",
            message: `report ${reportId}: model output carried JSON debris; affected fields were truncated at the derail point`,
        });
    }
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
