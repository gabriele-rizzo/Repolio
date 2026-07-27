import type { Snapshot } from "@/generated/prisma/browser";
import { describe, expect, it } from "vitest";
import type { SnapshotData } from "../zernio/types";
import { computeMetrics } from "./compute";

// Rows modeled on the first customer's data (snapshot analysis, Jul 2026): pure lead-gen, lead
// values stored in actionValues, Zernio's scalars poisoned (conversions passthrough, purchaseValue
// carrying lead values → fake 74.5x ROAS).

const day = (data: Partial<SnapshotData>, date = "2026-07-14"): Snapshot =>
    ({
        data: {
            date,
            currency: "EUR",
            spend: 0,
            impressions: 0,
            reach: 0,
            clicks: 0,
            ctr: 0,
            cpc: 0,
            cpm: 0,
            conversions: 0,
            costPerConversion: 0,
            purchaseValue: 0,
            roas: 0,
            ...data,
        },
    }) as unknown as Snapshot;

describe("computeMetrics", () => {
    it("returns null without usable rows", () => {
        expect(computeMetrics([])).toBeNull();
    });

    it("never derives revenue/ROAS from the purchaseValue scalar (the fake-ROAS bug)", () => {
        // Account-506 shape: purchaseValue claims 1800 but it's a lead value; zero purchase events.
        const m = computeMetrics([
            day({
                spend: 24.16,
                impressions: 1200,
                clicks: 29,
                conversions: 0, // Zernio scalar says 0...
                purchaseValue: 1800, // ...but claims revenue
                roas: 74.5,
                actions: { fb_pixel_lead: 2, link_click: 19 },
                actionValues: { fb_pixel_lead: 1800 },
            }),
        ]);

        expect(m).not.toBeNull();
        expect(m!.revenue).toBeNull();
        expect(m!.roas).toBeNull();
        expect(m!.purchases).toBe(0);
        expect(m!.leads).toBe(2);
        expect(m!.conversions).toBe(2); // from the actions map, not the scalar
        expect(m!.cpl).toBeCloseTo(12.08);
        expect(m!.cpa).toBeCloseTo(12.08); // conversions = leads here
    });

    it("ignores the conversions scalar entirely (identical actions ⇒ identical conversions)", () => {
        // The 505-vs-502 inconsistency: same action pattern, scalars 2 vs 0.
        const a = computeMetrics([day({ spend: 10, conversions: 2, actions: { fb_pixel_lead: 5 } })]);
        const b = computeMetrics([day({ spend: 10, conversions: 0, actions: { fb_pixel_lead: 5 } })]);
        expect(a!.conversions).toBe(5);
        expect(b!.conversions).toBe(5);
    });

    it("computes CTR/CPC on link clicks, falling back to all clicks when never broken out", () => {
        const withBreakout = computeMetrics([
            day({ spend: 100, impressions: 10_000, clicks: 3263, actions: { link_click: 2117 } }),
        ]);
        expect(withBreakout!.linkClicks).toBe(2117);
        expect(withBreakout!.ctr).toBeCloseTo(21.17);
        expect(withBreakout!.cpc).toBeCloseTo(100 / 2117);

        const withoutBreakout = computeMetrics([day({ spend: 100, impressions: 10_000, clicks: 3263 })]);
        expect(withoutBreakout!.linkClicks).toBeNull();
        expect(withoutBreakout!.ctr).toBeCloseTo(32.63);
        expect(withoutBreakout!.cpc).toBeCloseTo(100 / 3263);
    });

    it("falls back to all clicks when link_click coverage is PARTIAL across the window", () => {
        // One active day breaks out link_click, another day has clicks but no breakdown (Meta omits
        // it on some days). Summing only the covered day's link clicks against full-window
        // impressions/spend would yield a CTR/CPC that is neither the true link nor all-clicks
        // figure — so the whole window must fall back to all clicks.
        const m = computeMetrics([
            day({ spend: 50, impressions: 1000, clicks: 100, actions: { link_click: 50 } }, "2026-07-14"),
            day({ spend: 50, impressions: 1000, clicks: 100 }, "2026-07-15"),
        ]);
        expect(m!.linkClicks).toBeNull(); // incomplete → not reported as a measured total
        expect(m!.ctr).toBeCloseTo(10); // 200 all clicks / 2000 impressions, not 50/2000 = 2.5
        expect(m!.cpc).toBeCloseTo(0.5); // 100 spend / 200 all clicks, not 100/50 = 2.0
    });

    it("keeps the link basis when only zero-click days lack the breakdown", () => {
        // Zero-delivery days (no clicks, no breakdown) are truthful zeros, not missing measurements
        // — they must not force the all-clicks fallback.
        const m = computeMetrics([
            day({ spend: 100, impressions: 10_000, clicks: 300, actions: { link_click: 250 } }, "2026-07-14"),
            day({ spend: 0, impressions: 0, clicks: 0 }, "2026-07-15"),
        ]);
        expect(m!.linkClicks).toBe(250);
        expect(m!.ctr).toBeCloseTo(2.5); // 250 / 10000
    });

    it("nulls every unmeasured rate instead of storing 0", () => {
        const m = computeMetrics([day({ spend: 5 })]);
        expect(m!.ctr).toBeNull(); // impressions 0 (was 0 before the fix)
        expect(m!.cpm).toBeNull();
        expect(m!.cpa).toBeNull();
        expect(m!.cpl).toBeNull();
        expect(m!.cpc).toBeNull();
        expect(m!.roas).toBeNull();
        expect(m!.revenue).toBeNull();
    });

    it("sums purchases and revenue from the maps for e-commerce rows", () => {
        const m = computeMetrics([
            day({ spend: 50, impressions: 5000, clicks: 200, actions: { purchase: 3 }, actionValues: { purchase: 300 } }),
            day({ spend: 50, impressions: 5000, clicks: 200, actions: { purchase: 1 }, actionValues: { purchase: 100 } }, "2026-07-15"),
        ]);
        expect(m!.purchases).toBe(4);
        expect(m!.revenue).toBe(400);
        expect(m!.roas).toBe(4);
        expect(m!.cpa).toBe(25);
    });

    it("lets a good lead-gen account out of the old 55/65 ceiling", () => {
        // 7.5% conversion rate, 2% link CTR, frequency 2.5 — a genuinely healthy account that the
        // old scorer capped at 65 because lead-gen was hardcoded to anchor at 55.
        const leadGen = computeMetrics([
            day({ spend: 100, impressions: 20_000, reach: 8000, actions: { lead: 30, link_click: 400 } }),
        ]);
        expect(leadGen!.performance_score).toBeGreaterThanOrEqual(70);
        expect(leadGen!.score_label).toBe("STRONG");
    });

    it("blends every measurable dimension instead of the old 50/55/65 constants", () => {
        const m = computeMetrics([
            day({ spend: 100, impressions: 20_000, reach: 8000, actions: { lead: 30, link_click: 400 } }),
        ]);
        // Single-day window: no consistency/momentum (needs 5+/6+ days), no ROI (no revenue).
        expect(m!.score_components.map((c) => c.key).sort()).toEqual(["conversion_rate", "ctr", "frequency"]);
        // 20k impressions ⇒ full volume confidence, but three of six dimensions ⇒ some breadth shrink.
        expect(m!.score_confidence).toBeGreaterThan(0.8);
        expect(m!.score_confidence).toBeLessThan(1);
    });

    it("separates two lead-gen accounts that the old score gave the same number", () => {
        // Same conversion count and spend; one converts 7.5% of its clicks at a healthy frequency,
        // the other 1.5% while burning its audience. Both scored exactly 65 before.
        const good = computeMetrics([
            day({ spend: 100, impressions: 20_000, reach: 9000, actions: { lead: 30, link_click: 400 } }),
        ]);
        const poor = computeMetrics([
            day({ spend: 100, impressions: 20_000, reach: 3000, actions: { lead: 30, link_click: 2000 } }),
        ]);
        expect(good!.performance_score).toBeGreaterThan(poor!.performance_score + 10);
    });

    it("rewards ROAS on a curve rather than a straight line to 100", () => {
        const ecom = (revenue: number) =>
            computeMetrics([
                day({
                    spend: 1000,
                    impressions: 100_000,
                    clicks: 2000,
                    reach: 50_000,
                    actions: { purchase: 40, link_click: 1500 },
                    actionValues: { purchase: revenue },
                }),
            ])!.performance_score;

        expect(ecom(1000)).toBeLessThan(ecom(4000)); // 1x vs 4x ROAS
        expect(ecom(4000)).toBeLessThan(ecom(10_000)); // 4x vs 10x
        expect(ecom(10_000)).toBeGreaterThanOrEqual(70); // STRONG territory
        // 0.5x ROAS drags the account below neutral even though its traffic metrics are fine —
        // ROI carries 45 of the ~90 available weight once revenue is measured.
        expect(ecom(500)).toBeLessThan(50);
    });

    it("penalises a window that bought real traffic and converted nobody", () => {
        const noConversions = computeMetrics([
            day({ spend: 500, impressions: 50_000, clicks: 900, reach: 20_000, actions: { link_click: 800 } }),
        ]);
        const cvr = noConversions!.score_components.find((c) => c.key === "conversion_rate");
        expect(cvr?.score).toBe(0);
        // Healthy CTR, frequency and delivery must not blend it back up to a passing grade.
        expect(noConversions!.performance_score).toBeLessThan(40);
        expect(noConversions!.score_label).toBe("NEEDS_IMPROVEMENT");
    });

    it("stays near neutral on thin traffic instead of scoring off noise", () => {
        // A flattering 5% CTR on 400 impressions and nothing else measurable. Zero conversions on
        // 20 clicks is too little to call, so the CVR dimension stays out, and both shrink factors
        // (volume, breadth) pull what's left of the blend back toward 50.
        const thin = computeMetrics([day({ spend: 10, impressions: 400, clicks: 20 })]);
        expect(thin!.score_components.some((c) => c.key === "conversion_rate")).toBe(false);
        expect(thin!.score_confidence).toBeLessThan(0.3);
        expect(thin!.performance_score).toBeGreaterThan(45);
        expect(thin!.performance_score).toBeLessThan(60);
    });

    it("scores delivery consistency and in-window trend over a multi-day window", () => {
        const steady = Array.from({ length: 14 }, (_, i) =>
            day(
                { spend: 50, impressions: 5000, reach: 2500, actions: { lead: 5, link_click: 100 } },
                `2026-07-${String(i + 1).padStart(2, "0")}`,
            ),
        );
        const erratic = Array.from({ length: 14 }, (_, i) =>
            day(
                i % 3 === 0
                    ? { spend: 200, impressions: 20_000, reach: 10_000, actions: { lead: 20, link_click: 400 } }
                    : { spend: 0, impressions: 0, reach: 0 },
                `2026-07-${String(i + 1).padStart(2, "0")}`,
            ),
        );

        const s = computeMetrics(steady)!;
        const e = computeMetrics(erratic)!;
        expect(s.score_components.map((c) => c.key)).toContain("consistency");
        expect(s.score_components.map((c) => c.key)).toContain("momentum");
        expect(s.score_components.find((c) => c.key === "consistency")!.score).toBeGreaterThan(
            e.score_components.find((c) => c.key === "consistency")!.score,
        );
    });

    it("stays neutral when a window delivered nothing at all", () => {
        const empty = computeMetrics([day({ spend: 0, impressions: 0, clicks: 0, reach: 0 })]);
        expect(empty!.performance_score).toBe(50);
        expect(empty!.score_components).toEqual([]);
    });
});
