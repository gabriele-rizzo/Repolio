import { ScoreLabel } from "@/generated/prisma/enums";
import {
    scoreLabel,
    scorePerformance,
    type ScoreComponentKey,
    type ScoreDay,
    type ScoreInput,
} from "@/lib/metrics/score";
import { describe, expect, it } from "vitest";

// The score is the product's headline number and it is recomputed on every surface that shows it —
// dashboard card, report page, batch email, PDF template, AI prompt. Nothing persists it, so a
// regression here changes what five surfaces claim at once, silently and consistently. These tests
// pin the behaviour that is load-bearing: which dimensions a window is judged on, which benchmark
// curve each one uses, the ceiling hygiene can't exceed, and the shrink that keeps thin windows off
// the extremes.

/** A window with every dimension switched off, so one can be switched on in isolation. */
const NOTHING: ScoreInput = {
    spend: 0,
    impressions: 0,
    clickBasis: 0,
    ctrBasis: "link",
    conversions: 0,
    purchases: 0,
    revenue: null,
    frequency: null,
    ctr: null,
    roas: null,
    days: [],
};

const input = (over: Partial<ScoreInput> = {}): ScoreInput => ({ ...NOTHING, ...over });

const day = (date: string, over: Partial<ScoreDay> = {}): ScoreDay => ({
    date,
    spend: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: null,
    conversions: 0,
    revenue: null,
    ...over,
});

/** `n` identical consecutive days from 2026-01-01. */
const runOfDays = (n: number, per: Partial<ScoreDay> = {}): ScoreDay[] =>
    Array.from({ length: n }, (_, i) => day(`2026-01-${String(i + 1).padStart(2, "0")}`, per));

const keys = (r: ReturnType<typeof scorePerformance>): ScoreComponentKey[] => r.components.map((c) => c.key);
const component = (r: ReturnType<typeof scorePerformance>, key: ScoreComponentKey) =>
    r.components.find((c) => c.key === key);

describe("scoreLabel", () => {
    it("bands on 70 and 40, inclusive at the lower edge of each band", () => {
        expect(scoreLabel(100)).toBe(ScoreLabel.STRONG);
        expect(scoreLabel(70)).toBe(ScoreLabel.STRONG);
        expect(scoreLabel(69)).toBe(ScoreLabel.MODERATE);
        expect(scoreLabel(40)).toBe(ScoreLabel.MODERATE);
        expect(scoreLabel(39)).toBe(ScoreLabel.NEEDS_IMPROVEMENT);
        expect(scoreLabel(0)).toBe(ScoreLabel.NEEDS_IMPROVEMENT);
    });
});

describe("scorePerformance — nothing measurable", () => {
    it("returns a neutral 50 with no components and zero confidence", () => {
        // A window with no delivery must not read as "performed terribly" on the rating scale: a 0
        // and a 50 look nothing alike to a client, and the truth is "we can't tell".
        const result = scorePerformance(input());

        expect(result).toEqual({ score: 50, label: ScoreLabel.MODERATE, components: [], confidence: 0 });
    });

    it("stays neutral for a window whose days exist but delivered nothing", () => {
        const result = scorePerformance(input({ days: runOfDays(4) }));

        // Four days is under the 5-day consistency floor, so there is still nothing to judge.
        expect(result.score).toBe(50);
        expect(result.components).toEqual([]);
    });

    it("agrees with its own label", () => {
        const result = scorePerformance(input());
        expect(result.label).toBe(scoreLabel(result.score));
    });
});

describe("roi", () => {
    it("is measured only when purchase revenue, spend and a ROAS are all present", () => {
        expect(keys(scorePerformance(input({ revenue: 1000, spend: 250, roas: 4 })))).toContain("roi");

        // No revenue measured — there is no ROI to judge, and inventing one is what produced the
        // fake 74.5x this guard exists for.
        expect(keys(scorePerformance(input({ revenue: null, spend: 250, roas: 4 })))).not.toContain("roi");
        // Zero spend: a ratio with no denominator.
        expect(keys(scorePerformance(input({ revenue: 1000, spend: 0, roas: 4 })))).not.toContain("roi");
        expect(keys(scorePerformance(input({ revenue: 1000, spend: 250, roas: null })))).not.toContain("roi");
    });

    it("scores the published ROAS anchors exactly", () => {
        const roiAt = (roas: number) =>
            component(scorePerformance(input({ revenue: 1, spend: 1, roas })), "roi")?.score;

        // Anchor points of ROAS_CURVE — ~2x is around break-even, 4x is a good account.
        expect(roiAt(0)).toBe(0);
        expect(roiAt(1)).toBe(28);
        expect(roiAt(2)).toBe(55);
        expect(roiAt(4)).toBe(82);
        expect(roiAt(10)).toBe(100);
    });

    it("interpolates between anchors instead of stepping", () => {
        // The whole point of the curve rewrite: two accounts that differ slightly must differ
        // slightly, not land on the same constant.
        const at = (roas: number) => component(scorePerformance(input({ revenue: 1, spend: 1, roas })), "roi")!.score;

        expect(at(2.5)).toBeGreaterThan(at(2));
        expect(at(2.5)).toBeLessThan(at(3));
        expect(at(2.1)).not.toBe(at(2.9));
    });

    it("flattens outside the curve rather than extrapolating past 0-100", () => {
        const at = (roas: number) => component(scorePerformance(input({ revenue: 1, spend: 1, roas })), "roi")!.score;

        expect(at(50)).toBe(100);
        expect(at(-3)).toBe(0);
    });

    it("carries the measured input in its detail string", () => {
        const roi = component(scorePerformance(input({ revenue: 1, spend: 1, roas: 3.417 })), "roi");
        expect(roi?.detail).toBe("ROAS 3.42x");
        expect(roi?.label).toBe("Return on ad spend");
    });
});

describe("conversion_rate", () => {
    it("is measured when the window converted, however little traffic it had", () => {
        expect(keys(scorePerformance(input({ clickBasis: 10, conversions: 1 })))).toContain("conversion_rate");
    });

    it("is measured on a zero-conversion window only once traffic passes the 50-click floor", () => {
        // Below the floor, zero conversions is thin traffic rather than a failure to convert.
        expect(keys(scorePerformance(input({ clickBasis: 49, conversions: 0 })))).not.toContain("conversion_rate");
        // At the floor it becomes a finding, and it is scored as the zero it is.
        const atFloor = scorePerformance(input({ clickBasis: 50, conversions: 0 }));
        expect(keys(atFloor)).toContain("conversion_rate");
        expect(component(atFloor, "conversion_rate")?.score).toBe(0);
    });

    it("is not measured without clicks at all", () => {
        expect(keys(scorePerformance(input({ clickBasis: 0, conversions: 5 })))).not.toContain("conversion_rate");
    });

    it("judges purchases on the checkout curve and everything else on the lead curve", () => {
        // Same 2.5% rate: unremarkable for a lead form, strong for a checkout. One shared curve
        // would systematically flatter lead-gen.
        const rate = { clickBasis: 1000, conversions: 25 };
        const ecommerce = scorePerformance(input({ ...rate, purchases: 25 }));
        const leadgen = scorePerformance(input({ ...rate, purchases: 0 }));

        expect(component(ecommerce, "conversion_rate")?.score).toBe(65);
        expect(component(leadgen, "conversion_rate")?.score).toBe(32);
        expect(component(ecommerce, "conversion_rate")?.label).toBe("Purchase rate");
        expect(component(leadgen, "conversion_rate")?.label).toBe("Conversion rate");
    });

    it("is dialled back when ROI is also measured, so the same success isn't paid for twice", () => {
        const withRoi = scorePerformance(input({ clickBasis: 1000, conversions: 25, purchases: 25, revenue: 500, spend: 100, roas: 5 }));
        const withoutRoi = scorePerformance(input({ clickBasis: 1000, conversions: 25, purchases: 25 }));

        expect(component(withRoi, "conversion_rate")?.weight).toBe(15);
        expect(component(withoutRoi, "conversion_rate")?.weight).toBe(25);
    });

    it("reports the rate and its raw terms in the detail string", () => {
        const cvr = component(scorePerformance(input({ clickBasis: 400, conversions: 12 })), "conversion_rate");
        expect(cvr?.detail).toBe("3.00% (12 from 400 clicks)");
    });
});

describe("ctr", () => {
    it("needs both a rate and impressions to stand on", () => {
        expect(keys(scorePerformance(input({ ctr: 1.2, impressions: 5000 })))).toContain("ctr");
        expect(keys(scorePerformance(input({ ctr: null, impressions: 5000 })))).not.toContain("ctr");
        expect(keys(scorePerformance(input({ ctr: 1.2, impressions: 0 })))).not.toContain("ctr");
    });

    it("judges an all-clicks window on a stretched curve, not the link one", () => {
        // All-clicks CTR runs roughly twice link CTR (reactions, profile taps, expands), so the same
        // number is worth less when it came from the all-clicks series.
        const link = scorePerformance(input({ ctr: 1.2, impressions: 5000, ctrBasis: "link" }));
        const all = scorePerformance(input({ ctr: 1.2, impressions: 5000, ctrBasis: "all" }));

        expect(component(link, "ctr")?.score).toBe(58);
        expect(component(all, "ctr")?.score).toBe(33);
        expect(component(link, "ctr")?.label).toBe("Link CTR");
        expect(component(all, "ctr")?.label).toBe("CTR (all clicks)");
    });

    it("labels the detail with the basis it was judged on", () => {
        expect(component(scorePerformance(input({ ctr: 2.5, impressions: 100 })), "ctr")?.detail).toBe("Link CTR 2.50%");
    });
});

describe("frequency", () => {
    it("is measured only on a window with a positive frequency", () => {
        expect(keys(scorePerformance(input({ frequency: 1.8 })))).toContain("frequency");
        expect(keys(scorePerformance(input({ frequency: null })))).not.toContain("frequency");
        expect(keys(scorePerformance(input({ frequency: 0 })))).not.toContain("frequency");
    });

    it("peaks in the healthy band and falls off on both sides", () => {
        const at = (frequency: number) => component(scorePerformance(input({ frequency })), "frequency")!.score;

        // Under-reinforced below ~1.2, healthy 1.5-2.5, creative fatigue past ~3.5. Unlike every
        // other dimension this curve is NOT monotonic — more is not better.
        expect(at(1.8)).toBe(100);
        expect(at(0.9)).toBe(78);
        expect(at(0.5)).toBe(78);
        expect(at(2.5)).toBe(92);
        expect(at(3.5)).toBe(66);
        expect(at(6)).toBe(22);
        expect(at(20)).toBe(0);

        expect(at(1.3)).toBeLessThan(at(1.8));
        expect(at(3)).toBeLessThan(at(1.8));
    });

    it("is weighted light, because window reach over-counts repeat users", () => {
        expect(component(scorePerformance(input({ frequency: 1.8 })), "frequency")?.weight).toBe(10);
    });
});

describe("consistency", () => {
    it("needs at least five days before delivery health means anything", () => {
        expect(keys(scorePerformance(input({ days: runOfDays(4, { spend: 10 }) })))).not.toContain("consistency");
        expect(keys(scorePerformance(input({ days: runOfDays(5, { spend: 10 }) })))).toContain("consistency");
    });

    it("scores a full, evenly paced window at the top", () => {
        const result = scorePerformance(input({ days: runOfDays(10, { spend: 10, impressions: 100 }) }));

        expect(component(result, "consistency")?.score).toBe(100);
        expect(component(result, "consistency")?.detail).toBe("10/10 days delivering, spend CV 0.00");
    });

    it("penalises a window that only delivered on half its days", () => {
        const days = [...runOfDays(5, { spend: 10 }), ...runOfDays(5).map((d, i) => day(`2026-02-0${i + 1}`))];
        const result = scorePerformance(input({ days }));

        // Coverage 0.5 → 40, stability perfect → 100, blended 0.6/0.4 → 64.
        expect(component(result, "consistency")?.score).toBe(64);
        expect(component(result, "consistency")?.detail).toBe("5/10 days delivering, spend CV 0.00");
    });

    it("penalises stop-start pacing even at full coverage", () => {
        const steady = runOfDays(6, { spend: 100 });
        const spiky = [
            day("2026-01-01", { spend: 5 }),
            day("2026-01-02", { spend: 400 }),
            day("2026-01-03", { spend: 5 }),
            day("2026-01-04", { spend: 380 }),
            day("2026-01-05", { spend: 10 }),
            day("2026-01-06", { spend: 200 }),
        ];

        const steadyScore = component(scorePerformance(input({ days: steady })), "consistency")!.score;
        const spikyScore = component(scorePerformance(input({ days: spiky })), "consistency")!.score;

        expect(steadyScore).toBe(100);
        expect(spikyScore).toBeLessThan(steadyScore);
    });

    it("falls back to coverage alone when too few days delivered to measure variation", () => {
        // Coefficient of variation needs three points to mean anything; with two, coverage is the
        // whole score and the detail omits the CV rather than printing a meaningless one.
        const days = [
            day("2026-01-01", { spend: 10 }),
            day("2026-01-02", { spend: 10 }),
            day("2026-01-03"),
            day("2026-01-04"),
            day("2026-01-05"),
        ];
        const consistency = component(scorePerformance(input({ days })), "consistency");

        expect(consistency?.score).toBe(30);
        expect(consistency?.detail).toBe("2/5 days delivering");
    });

    it("counts a day that delivered impressions without recorded spend as active", () => {
        const days = runOfDays(5, { impressions: 500 });
        expect(component(scorePerformance(input({ days })), "consistency")?.detail).toContain("5/5 days delivering");
    });
});

describe("momentum", () => {
    it("needs at least six days to split into halves", () => {
        const per = { spend: 10, revenue: 10, impressions: 100, clicks: 5, linkClicks: 5 };
        expect(keys(scorePerformance(input({ revenue: 60, days: runOfDays(5, per) })))).not.toContain("momentum");
        expect(keys(scorePerformance(input({ revenue: 60, days: runOfDays(6, per) })))).toContain("momentum");
    });

    it("compares the second half against the first on ROAS when revenue is measured", () => {
        const days = [
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 1}`, { spend: 30, revenue: 30 })),
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 4}`, { spend: 30, revenue: 42 })),
        ];
        const momentum = component(scorePerformance(input({ revenue: 216, days })), "momentum");

        // 1.0x → 1.4x is the 1.4 anchor of the momentum curve.
        expect(momentum?.score).toBe(85);
        expect(momentum?.detail).toBe("ROAS 1.40x vs first half");
    });

    it("falls back to conversions per spend when there is no revenue", () => {
        const days = [
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 1}`, { spend: 100, conversions: 10 })),
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 4}`, { spend: 100, conversions: 5 })),
        ];
        const momentum = component(scorePerformance(input({ conversions: 45, days })), "momentum");

        expect(momentum?.detail).toBe("conversions per spend 0.50x vs first half");
        // A halving is a bad trend and must score below the flat-1.0x midpoint.
        expect(momentum!.score).toBeLessThan(55);
    });

    it("falls back to CTR when nothing converted at all", () => {
        const days = [
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 1}`, { impressions: 1000, linkClicks: 10 })),
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 4}`, { impressions: 1000, linkClicks: 20 })),
        ];
        const momentum = component(scorePerformance(input({ days })), "momentum");

        expect(momentum?.detail).toBe("CTR 2.00x vs first half");
        expect(momentum?.score).toBe(100);
    });

    it("uses the click series the window's rates are based on", () => {
        // ctrBasis "all" must read d.clicks; a window whose linkClicks are null would otherwise
        // compute a 0/0 ratio and drop the dimension entirely.
        const days = [
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 1}`, { impressions: 1000, clicks: 10 })),
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 4}`, { impressions: 1000, clicks: 20 })),
        ];

        expect(keys(scorePerformance(input({ ctrBasis: "all", days })))).toContain("momentum");
        expect(keys(scorePerformance(input({ ctrBasis: "link", days })))).not.toContain("momentum");
    });

    it("is dropped when the first half has no baseline to compare against", () => {
        const days = [
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 1}`, { spend: 0 })),
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 4}`, { spend: 30, revenue: 60 })),
        ];

        // Dividing by a zero baseline would report an infinite improvement.
        expect(keys(scorePerformance(input({ revenue: 60, days })))).not.toContain("momentum");
    });

    it("reads the window chronologically regardless of the order days arrive in", () => {
        const chronological = [
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 1}`, { spend: 30, revenue: 30 })),
            ...Array.from({ length: 3 }, (_, i) => day(`2026-01-0${i + 4}`, { spend: 30, revenue: 42 })),
        ];
        const shuffled = [chronological[4], chronological[0], chronological[5], chronological[2], chronological[1], chronological[3]];

        // Momentum is the one dimension where row order changes the answer, and callers pass rows
        // straight from a query — so the sort has to happen inside.
        expect(scorePerformance(input({ revenue: 216, days: shuffled }))).toEqual(
            scorePerformance(input({ revenue: 216, days: chronological })),
        );
    });
});

describe("blend and confidence", () => {
    it("shrinks a thin window toward neutral", () => {
        // Single dimension, no volume: a 55 on ROI alone is worth 0.2 × 0.8 of its distance from 50.
        const result = scorePerformance(input({ revenue: 1, spend: 1, roas: 2 }));

        expect(result.confidence).toBeCloseTo(0.16, 10);
        expect(result.score).toBe(51);
    });

    it("lets a broad, high-volume window keep almost all of its blend", () => {
        const thick = scorePerformance(
            input({
                spend: 5_000,
                impressions: 500_000,
                clickBasis: 10_000,
                conversions: 400,
                purchases: 400,
                revenue: 25_000,
                frequency: 1.8,
                ctr: 2,
                roas: 5,
                days: runOfDays(30, { spend: 166, impressions: 16_666, clicks: 333, linkClicks: 333, conversions: 13, revenue: 833 }),
            }),
        );

        expect(thick.confidence).toBeGreaterThan(0.95);
        expect(thick.score).toBeGreaterThanOrEqual(70);
        expect(thick.label).toBe(ScoreLabel.STRONG);
    });

    it("gives the same performance a score nearer 50 when the window is small", () => {
        const shape = {
            spend: 100,
            clickBasis: 200,
            conversions: 8,
            purchases: 8,
            revenue: 500,
            frequency: 1.8,
            ctr: 2,
            roas: 5,
        };
        const loud = scorePerformance(input({ ...shape, impressions: 200_000 }));
        const quiet = scorePerformance(input({ ...shape, impressions: 300 }));

        expect(quiet.confidence).toBeLessThan(loud.confidence);
        expect(Math.abs(quiet.score - 50)).toBeLessThan(Math.abs(loud.score - 50));
    });

    it("never reports a score outside 0-100, at either extreme", () => {
        const best = scorePerformance(
            input({
                spend: 1_000,
                impressions: 1_000_000,
                clickBasis: 100_000,
                conversions: 20_000,
                purchases: 20_000,
                revenue: 100_000,
                frequency: 1.8,
                ctr: 12,
                roas: 100,
                days: runOfDays(30, { spend: 33, impressions: 33_333, clicks: 3_333, linkClicks: 3_333, conversions: 666, revenue: 3_333 }),
            }),
        );
        const worst = scorePerformance(
            input({
                spend: 10_000,
                impressions: 1_000_000,
                clickBasis: 100_000,
                conversions: 0,
                purchases: 0,
                revenue: 0,
                frequency: 12,
                ctr: 0,
                roas: 0,
                days: runOfDays(30, { spend: 333, impressions: 33_333, clicks: 3_333, linkClicks: 3_333 }),
            }),
        );

        expect(best.score).toBeLessThanOrEqual(100);
        expect(worst.score).toBeGreaterThanOrEqual(0);
        expect(best.score).toBeGreaterThan(worst.score);
        for (const c of [...best.components, ...worst.components]) {
            expect(c.score).toBeGreaterThanOrEqual(0);
            expect(c.score).toBeLessThanOrEqual(100);
            expect(Number.isInteger(c.score)).toBe(true);
        }
        expect(Number.isInteger(best.score)).toBe(true);
    });
});

describe("hygiene headroom", () => {
    it("stops perfect hygiene from carrying an account that converts nobody", () => {
        // Delivers every day, ideal frequency, eye-catching CTR, improving — and zero conversions on
        // 20k clicks. Without the cap the hygiene dimensions blend their way to a passing score.
        const result = scorePerformance(
            input({
                spend: 4_000,
                impressions: 400_000,
                clickBasis: 20_000,
                conversions: 0,
                purchases: 0,
                frequency: 1.8,
                ctr: 5,
                days: [
                    ...Array.from({ length: 15 }, (_, i) => day(`2026-01-${String(i + 1).padStart(2, "0")}`, { spend: 133, impressions: 13_333, clicks: 666, linkClicks: 666 })),
                    ...Array.from({ length: 15 }, (_, i) => day(`2026-01-${String(i + 16).padStart(2, "0")}`, { spend: 133, impressions: 13_333, clicks: 1_400, linkClicks: 1_400 })),
                ],
            }),
        );

        expect(component(result, "conversion_rate")?.score).toBe(0);
        expect(component(result, "ctr")!.score).toBeGreaterThan(90);
        expect(component(result, "consistency")!.score).toBe(100);
        expect(result.score).toBeLessThan(40);
        expect(result.label).toBe(ScoreLabel.NEEDS_IMPROVEMENT);
    });

    it("never lets the blend exceed the measured outcome by more than the allowance", () => {
        const cases: ScoreInput[] = [
            input({ clickBasis: 5_000, conversions: 0, impressions: 200_000, ctr: 6, frequency: 1.8, days: runOfDays(20, { spend: 50, impressions: 10_000, clicks: 250, linkClicks: 250 }) }),
            input({ clickBasis: 5_000, conversions: 10, purchases: 10, revenue: 100, spend: 5_000, roas: 0.02, impressions: 200_000, ctr: 6, frequency: 1.8, days: runOfDays(20, { spend: 250, impressions: 10_000, clicks: 250, linkClicks: 250, revenue: 5 }) }),
        ];

        for (const c of cases) {
            const result = scorePerformance(c);
            const outcome = result.components.filter((x) => x.key === "roi" || x.key === "conversion_rate");
            expect(outcome.length).toBeGreaterThan(0);

            const outcomeWeight = outcome.reduce((a, x) => a + x.weight, 0);
            const outcomeScore = outcome.reduce((a, x) => a + x.score * x.weight, 0) / outcomeWeight;
            const ceiling = Math.round(50 + (outcomeScore + 30 - 50) * result.confidence);

            expect(result.score).toBeLessThanOrEqual(ceiling);
        }
    });

    it("does not cap a window with too little traffic to have an outcome at all", () => {
        // 30 clicks and no conversions is not a failure to convert, so there is no outcome to be
        // held to and hygiene is all the window has to say.
        const result = scorePerformance(input({ clickBasis: 30, conversions: 0, impressions: 20_000, ctr: 6, frequency: 1.8 }));

        expect(keys(result)).not.toContain("conversion_rate");
        expect(result.score).toBeGreaterThan(50);
    });
});

describe("components list", () => {
    it("reports only the dimensions the window could measure", () => {
        const result = scorePerformance(input({ ctr: 1.2, impressions: 5_000 }));
        expect(keys(result)).toEqual(["ctr"]);
    });

    it("orders by weight, then by key for a stable tie-break", () => {
        const result = scorePerformance(
            input({
                spend: 1_000,
                impressions: 200_000,
                clickBasis: 4_000,
                conversions: 100,
                purchases: 100,
                revenue: 4_000,
                frequency: 1.8,
                ctr: 2,
                roas: 4,
                days: runOfDays(20, { spend: 50, impressions: 10_000, clicks: 200, linkClicks: 200, conversions: 5, revenue: 200 }),
            }),
        );

        // roi 45, conversion_rate 15 (dialled back by roi), ctr 20, and three 10s alphabetically.
        expect(keys(result)).toEqual(["roi", "ctr", "conversion_rate", "consistency", "frequency", "momentum"]);

        const weights = result.components.map((c) => c.weight);
        expect([...weights]).toEqual([...weights].sort((a, b) => b - a));
    });

    it("gives every reported component a non-empty label and detail", () => {
        const result = scorePerformance(
            input({
                spend: 1_000,
                impressions: 200_000,
                clickBasis: 4_000,
                conversions: 100,
                purchases: 100,
                revenue: 4_000,
                frequency: 1.8,
                ctr: 2,
                roas: 4,
                days: runOfDays(20, { spend: 50, impressions: 10_000, clicks: 200, linkClicks: 200, conversions: 5, revenue: 200 }),
            }),
        );

        expect(result.components).toHaveLength(6);
        for (const c of result.components) {
            expect(c.label.length).toBeGreaterThan(0);
            expect(c.detail.length).toBeGreaterThan(0);
            expect(c.weight).toBeGreaterThan(0);
        }
    });
});

describe("determinism", () => {
    it("returns the same verdict for the same window every time", () => {
        // Every surface recomputes this from the same snapshots and they must not disagree.
        const window = input({
            spend: 900,
            impressions: 120_000,
            clickBasis: 3_000,
            conversions: 60,
            purchases: 60,
            revenue: 3_600,
            frequency: 2.1,
            ctr: 2.5,
            roas: 4,
            days: runOfDays(14, { spend: 64, impressions: 8_571, clicks: 214, linkClicks: 214, conversions: 4, revenue: 257 }),
        });

        expect(scorePerformance(window)).toEqual(scorePerformance(window));
    });

    it("does not mutate the caller's day array", () => {
        const days = [
            day("2026-01-03", { spend: 30, revenue: 42 }),
            day("2026-01-01", { spend: 30, revenue: 30 }),
            day("2026-01-02", { spend: 30, revenue: 30 }),
        ];
        const order = days.map((d) => d.date);

        scorePerformance(input({ revenue: 102, days }));

        expect(days.map((d) => d.date)).toEqual(order);
    });
});
