import type { Recommendation } from "@/components/report/recommendation-card";
import { isRecommendation, type GeneratedReport } from "@/lib/ai/report-prompt";

/**
 * Scrubs the JSON-structure debris a model can leave INSIDE a generated string field.
 *
 * The incident: a German report shipped to a client ending
 * `… bevor sich der Abwärtstrend fortsetzt.“}]}}]}. Bitte korrigiere die JSON-Struktur. Ich werde die
 * Antwort jetzt korrekt strukturieren.` — the model tried to close the object it thought it was in,
 * used a typographic `“` instead of a JSON `"`, so the decoder kept the whole attempt as string
 * content; the model then noticed, narrated its own repair, and every word of that landed in the
 * field. The response was still valid JSON against the schema, so nothing upstream objected: the
 * schema constrains the SHAPE, never what a string says.
 *
 * The rule is a cut, not a filter: once a value derails into structure characters, everything after
 * it is the model talking to itself, in whatever language the report is written in. Cutting at the
 * derail point is language-agnostic, where matching on "JSON" or "Struktur" would only ever catch
 * German.
 */

/**
 * Characters a derailing model strings together — JSON punctuation and the quotes around it.
 * Deliberately excludes `.`, `(`, `-` and `%`: those are ordinary prose and appear in every report.
 */
const DEBRIS_CHARS = "{}\\[\\]\"'`“”„‟«»‹›,;:\\s";

/** A maximal run of them. Two characters is the shortest run worth inspecting (`"}`). */
const DEBRIS_RUN = new RegExp(`[${DEBRIS_CHARS}]{2,}`, "g");

const BRACKETS = /[{}[\]]/g;

/**
 * How many brace/bracket characters one run must hold before it counts as debris rather than prose.
 *
 * Two, not one: prose legitimately contains a lone bracket (`Kampagne [Test]`, `{Platzhalter}`), but
 * never two inside a single run of punctuation — that shape only comes from a model closing a
 * structure. The observed `“}]}}]}` holds six.
 */
const MIN_BRACKETS = 2;

/** Trailing debris the cut can't catch, because a lone `"}` at the very end holds only one bracket. */
const TRAILING_DEBRIS = new RegExp(`[${DEBRIS_CHARS}]*[}\\]][${DEBRIS_CHARS}]*$`);

/**
 * Returns `value` up to the point it derails, trimmed. An undamaged string comes back unchanged —
 * compare against the input to detect that a repair happened.
 */
export function sanitizeGeneratedText(value: string): string {
    let out = value;

    for (const match of out.matchAll(DEBRIS_RUN)) {
        if ((match[0].match(BRACKETS)?.length ?? 0) >= MIN_BRACKETS) {
            out = out.slice(0, match.index);
            break;
        }
    }

    return out.replace(TRAILING_DEBRIS, "").trim();
}

export interface SanitizedReport {
    report: GeneratedReport;
    /** True when any field was altered — worth recording, since it means a generation half-failed. */
    repaired: boolean;
}

/**
 * Applies {@link sanitizeGeneratedText} to every model-authored string on a report: the trend
 * explanation and each recommendation's title and body. `priority` and `category` are enum-constrained
 * server-side and can't carry prose, so they are passed through.
 *
 * A recommendation left with no title or no body is dropped rather than rendered as a blank card.
 */
export function sanitizeGeneratedReport(generated: GeneratedReport): SanitizedReport {
    let repaired = false;

    const clean = (value: string): string => {
        const out = sanitizeGeneratedText(value);
        if (out !== value) repaired = true;
        return out;
    };

    const trend_explanation = clean(generated.trend_explanation);

    const recommendations = generated.recommendations
        .map((rec): Recommendation => ({ ...rec, title: clean(rec.title), body: clean(rec.body) }))
        .filter((rec) => {
            const keep = rec.title !== "" && rec.body !== "";
            if (!keep) repaired = true;
            return keep;
        });

    return { report: { trend_explanation, recommendations }, repaired };
}

/** A report row as it comes back from the database: the JSON column is unknown until inspected. */
export interface StoredReportText {
    trend_explanation: string | null;
    /** Prisma JSON column — an array of recommendations on every row the write path produced. */
    recommendations: unknown;
}

/**
 * Repairs a stored report row, for rows written before the scrub existed. Returns `null` when the row
 * is already clean, so a backfill writes only what actually changed.
 *
 * Applies exactly the rules {@link sanitizeGeneratedReport} applies on the way in — including dropping
 * a recommendation whose title or body was nothing but debris — so a repaired report is identical to
 * what today's write path would have produced. Entries that aren't recommendations at all are left
 * untouched: a backfill's job is to remove debris, not to reinterpret rows it doesn't recognise.
 *
 * Repairing already-delivered reports matters beyond the dashboard: the last three released reports
 * for an account are fed back into the prompt as trend context (see lib/ai/report-prompt.ts), so
 * debris left in place is debris the model reads back as an example of house style.
 */
export function repairStoredReport(stored: StoredReportText): SanitizedReport["report"] | null {
    let repaired = false;

    const clean = (value: string): string => {
        const out = sanitizeGeneratedText(value);
        if (out !== value) repaired = true;
        return out;
    };

    const trend_explanation = clean(stored.trend_explanation ?? "");

    const recommendations = (Array.isArray(stored.recommendations) ? stored.recommendations : [])
        .map((entry) => (isRecommendation(entry) ? { ...entry, title: clean(entry.title), body: clean(entry.body) } : entry))
        .filter((entry) => {
            if (!isRecommendation(entry)) return true;
            const keep = entry.title !== "" && entry.body !== "";
            if (!keep) repaired = true;
            return keep;
        }) as Recommendation[];

    return repaired ? { trend_explanation, recommendations } : null;
}
