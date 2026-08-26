import { repairStoredReport, sanitizeGeneratedReport, sanitizeGeneratedText } from "@/lib/ai/sanitize";
import type { Recommendation } from "@/components/report/recommendation-card";
import { describe, expect, it } from "vitest";

const rec = (over: Partial<Recommendation> = {}): Recommendation => ({
    priority: "THIS_WEEK",
    category: "BUDGET",
    title: "Budget auf Top-Kampagnen verschieben",
    body: "Die drei besten Anzeigengruppen liefern 70% der Conversions bei 40% des Spends.",
    ...over,
});

describe("sanitizeGeneratedText", () => {
    // The verbatim shape that reached a client, minus the leading sentence.
    it("cuts the model's self-repair spiral off at the structure debris", () => {
        const damaged =
            "Der Trend-Score von 46/100 zeigt, dass Conversions pro Spend nur noch 0,91x erreichten." +
            "“}]}}]}. Bitte korrigiere die JSON-Struktur. Ich werde die Antwort jetzt korrekt strukturieren.";

        expect(sanitizeGeneratedText(damaged)).toBe(
            "Der Trend-Score von 46/100 zeigt, dass Conversions pro Spend nur noch 0,91x erreichten.",
        );
    });

    it("strips a lone closing brace left at the end", () => {
        expect(sanitizeGeneratedText('Der ROAS ist auf 3,3x gestiegen."}')).toBe("Der ROAS ist auf 3,3x gestiegen.");
    });

    it("leaves undamaged prose byte-for-byte alone", () => {
        const clean =
            'Der ROAS stieg auf 3,30x (Vorperiode: 2,10x), während der CPA um 18% fiel. Die Kampagne "Sommer" trug 62% bei; ' +
            "Frequenz: 2,88 — unkritisch.";

        expect(sanitizeGeneratedText(clean)).toBe(clean);
    });

    // A single bracket inside a run is prose, not a derail; two is the signal.
    it("keeps a lone bracket pair used as punctuation", () => {
        const clean = "Die Kampagne [Test] und der Platzhalter {Betrag} bleiben erhalten.";
        expect(sanitizeGeneratedText(clean)).toBe(clean);
    });

    it("returns an empty string when the value is nothing but debris", () => {
        expect(sanitizeGeneratedText('"}]}}]}')).toBe("");
    });
});

describe("sanitizeGeneratedReport", () => {
    it("reports no repair for an intact response", () => {
        const result = sanitizeGeneratedReport({ trend_explanation: "Stabile Entwicklung.", recommendations: [rec()] });

        expect(result.repaired).toBe(false);
        expect(result.report.recommendations).toHaveLength(1);
    });

    it("cleans recommendation titles and bodies too, and flags the repair", () => {
        const result = sanitizeGeneratedReport({
            trend_explanation: "Stabile Entwicklung.",
            recommendations: [rec({ body: "Spend verlagern.“}]}} Ich strukturiere neu." })],
        });

        expect(result.repaired).toBe(true);
        expect(result.report.recommendations[0].body).toBe("Spend verlagern.");
        expect(result.report.recommendations[0].priority).toBe("THIS_WEEK");
    });

    it("drops a recommendation left with no body rather than rendering a blank card", () => {
        const result = sanitizeGeneratedReport({
            trend_explanation: "Stabile Entwicklung.",
            recommendations: [rec(), rec({ body: '"}]}}]}' })],
        });

        expect(result.repaired).toBe(true);
        expect(result.report.recommendations).toHaveLength(1);
    });
});

describe("repairStoredReport", () => {
    it("returns null for a row that needs nothing, so a backfill skips it", () => {
        expect(repairStoredReport({ trend_explanation: "Stabile Entwicklung.", recommendations: [rec()] })).toBeNull();
    });

    it("repairs a damaged row the way the write path would have written it", () => {
        const result = repairStoredReport({
            trend_explanation: "Der Abwärtstrend hält an.“}]}}]}. Bitte korrigiere die JSON-Struktur.",
            recommendations: [rec()],
        });

        expect(result?.trend_explanation).toBe("Der Abwärtstrend hält an.");
        expect(result?.recommendations).toHaveLength(1);
    });

    it("treats a null narrative as empty rather than throwing", () => {
        expect(repairStoredReport({ trend_explanation: null, recommendations: [] })).toBeNull();
    });

    it("leaves entries it does not recognise as recommendations in place", () => {
        const result = repairStoredReport({
            trend_explanation: 'Stabil."}',
            recommendations: [{ note: "legacy shape" }],
        });

        expect(result?.trend_explanation).toBe("Stabil.");
        expect(result?.recommendations).toEqual([{ note: "legacy shape" }]);
    });
});
