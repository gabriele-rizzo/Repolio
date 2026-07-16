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

    it("scores lead-gen accounts in the MODERATE band instead of 0 or a fake 100", () => {
        const leadGen = computeMetrics([
            day({ spend: 100, impressions: 20_000, reach: 8000, actions: { lead: 30, link_click: 400 } }),
        ]);
        // ctr = 400/20000 = 2% → +10 boost; frequency 2.5 → no penalty ⇒ 65 MODERATE.
        expect(leadGen!.performance_score).toBe(65);
        expect(leadGen!.score_label).toBe("MODERATE");

        const nothing = computeMetrics([day({ spend: 10, impressions: 1000, clicks: 10 })]);
        expect(nothing!.performance_score).toBe(50);
    });
});
