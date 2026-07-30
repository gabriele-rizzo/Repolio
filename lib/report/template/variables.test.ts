import type { ComputedMetrics } from "@/lib/metrics/compute";
import { buildVariables, SCALAR_VARIABLE_NAMES, VARIABLE_REFERENCE } from "@/lib/report/template/variables";
import { describe, expect, it } from "vitest";

const metrics = (over: Partial<ComputedMetrics> = {}): ComputedMetrics => ({
    currency: "EUR",
    spend: 12480.55,
    revenue: 41230.1,
    impressions: 1842301,
    clicks: 23110,
    linkClicks: 19870,
    conversions: 412,
    purchases: 412,
    leads: 0,
    reach: 640221,
    frequency: 2.88,
    ctr: 1.24,
    cpm: 6.77,
    cpa: 30.29,
    cpl: null,
    cpc: 0.63,
    roas: 3.3,
    performance_score: 78,
    score_label: "STRONG",
    score_components: [],
    score_confidence: 0.82,
    ...over,
});

const ctx = (over: Partial<Parameters<typeof buildVariables>[0]> = {}) =>
    buildVariables({
        accountName: "Cinemepic",
        platformLabel: "Meta",
        clientName: "Samuel",
        company: "Cinemepic Ltd",
        period: "01 July – 30 July",
        reportUrl: "https://example.com/r/1",
        periodStart: "01 July",
        periodEnd: "30 July",
        days: 30,
        generatedOn: "30 July",
        current: metrics(),
        previous: metrics({ spend: 10120.4, roas: 2.71, cpa: 34.9 }),
        scoreLabel: "Strong",
        deltaStyle: "arrow",
        ...over,
    });

describe("buildVariables", () => {
    it("formats money in the account's currency", () => {
        expect(ctx().spend).toBe("€12,480.55");
    });

    it("formats each metric shape", () => {
        const v = ctx();
        expect(v.roas).toBe("3.30x");
        expect(v.ctr).toBe("1.24%");
        expect(v.conversions).toBe("412");
        expect(v.reach).toBe("640.2K");
        expect(v.frequency).toBe("2.88");
    });

    it("renders a missing metric as an em dash, not null", () => {
        expect(ctx().cpl).toBe("—");
        expect(ctx({ current: null, previous: null }).spend).toBe("—");
    });

    it("renders a change with nothing to compare against as an em dash", () => {
        // No previous window at all — a template printing {{ .roasChange }} must not invent a zero.
        expect(ctx({ previous: null }).roasChange).toBe("—");
    });

    it("resolves every declared scalar name", () => {
        const vars = ctx();
        for (const name of SCALAR_VARIABLE_NAMES) {
            expect(vars, `missing variable: ${name}`).toHaveProperty(name);
        }
    });

    it("exposes context values", () => {
        const v = ctx();
        expect(v.accountName).toBe("Cinemepic");
        expect(v.clientName).toBe("Samuel");
        expect(v.company).toBe("Cinemepic Ltd");
        expect(v.days).toBe("30");
        expect(v.currency).toBe("EUR");
        expect(v.performanceScore).toBe("78");
        expect(v.scoreLabel).toBe("Strong");
    });

    it("falls back to an em dash for a client with no company", () => {
        expect(ctx({ company: null }).company).toBe("—");
    });
});

describe("delta style", () => {
    it("uses arrows for HTML surfaces", () => {
        const v = ctx({ deltaStyle: "arrow" });
        expect(v.spendChange).toBe("▲ 23%");
        expect(v.cpaChange).toBe("▼ 13%");
    });

    /**
     * Regression guard. The PDF is drawn with the built-in Helvetica, whose WinAnsi encoding has no
     * ▲ (U+25B2) or ▼ (U+25BC) — leaking one in renders visible mojibake ("² 23%") in a client-facing
     * attachment. This has now happened twice: once in the KPI grid, once via these placeholders.
     */
    it("emits no non-WinAnsi glyphs in sign mode, so the PDF cannot render mojibake", () => {
        const v = ctx({ deltaStyle: "sign" });
        expect(v.spendChange).toBe("+23%");
        expect(v.cpaChange).toBe("-13%");

        for (const [name, value] of Object.entries(v)) {
            expect(value, `${name} contains ▲`).not.toContain("▲");
            expect(value, `${name} contains ▼`).not.toContain("▼");
        }
    });
});

describe("VARIABLE_REFERENCE", () => {
    it("documents every scalar the editor can offer", () => {
        const documented = VARIABLE_REFERENCE.flatMap((g) => g.variables.map((v) => v.name));
        for (const name of SCALAR_VARIABLE_NAMES) expect(documented).toContain(name);
    });

    it("has no duplicate entries across groups", () => {
        const documented = VARIABLE_REFERENCE.flatMap((g) => g.variables.map((v) => v.name));
        expect(new Set(documented).size).toBe(documented.length);
    });
});
