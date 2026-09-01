import { describe, expect, it } from "vitest";
import { MIN_ZERO_RUN, missingDays, padRanges, toRanges, totalDays, zeroRuns, type HistoryDay } from "./gaps";

// A spending day, unless overridden — the baseline these tests deviate from.
const day = (date: string, over: Partial<HistoryDay> = {}): HistoryDay => ({
    date,
    spend: 10,
    impressions: 1000,
    clicks: 20,
    conversions: 1,
    ...over,
});

const zero = (date: string): HistoryDay => day(date, { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

const shape = (ranges: { from: string; to: string; days: number }[]) =>
    ranges.map((r) => `${r.from}..${r.to}(${r.days})`);

describe("toRanges", () => {
    it("returns nothing for no days", () => {
        expect(toRanges([])).toEqual([]);
    });

    it("collapses consecutive days into one range", () => {
        expect(shape(toRanges(["2026-08-03", "2026-08-04", "2026-08-05"]))).toEqual(["2026-08-03..2026-08-05(3)"]);
    });

    it("splits non-consecutive days", () => {
        expect(shape(toRanges(["2026-08-03", "2026-08-05"]))).toEqual([
            "2026-08-03..2026-08-03(1)",
            "2026-08-05..2026-08-05(1)",
        ]);
    });

    it("sorts and dedupes its input", () => {
        expect(shape(toRanges(["2026-08-05", "2026-08-03", "2026-08-04", "2026-08-04"]))).toEqual([
            "2026-08-03..2026-08-05(3)",
        ]);
    });

    it("spans month and year boundaries as contiguous", () => {
        expect(shape(toRanges(["2026-12-30", "2026-12-31", "2027-01-01"]))).toEqual(["2026-12-30..2027-01-01(3)"]);
    });
});

describe("missingDays", () => {
    it("finds a hole in the middle", () => {
        const have = new Set(["2026-08-01", "2026-08-02", "2026-08-06", "2026-08-07"]);
        expect(shape(missingDays(have, "2026-08-01", "2026-08-07"))).toEqual(["2026-08-03..2026-08-05(3)"]);
    });

    it("is inclusive of both bounds", () => {
        expect(shape(missingDays(new Set(["2026-08-02"]), "2026-08-01", "2026-08-03"))).toEqual([
            "2026-08-01..2026-08-01(1)",
            "2026-08-03..2026-08-03(1)",
        ]);
    });

    it("returns nothing when the window is complete", () => {
        const have = new Set(["2026-08-01", "2026-08-02", "2026-08-03"]);
        expect(missingDays(have, "2026-08-01", "2026-08-03")).toEqual([]);
    });

    it("reports a single-day window with no row", () => {
        expect(shape(missingDays(new Set(), "2026-08-01", "2026-08-01"))).toEqual(["2026-08-01..2026-08-01(1)"]);
    });
});

describe("zeroRuns", () => {
    it("ignores a run shorter than the minimum", () => {
        const history = [day("2026-08-01"), zero("2026-08-02"), zero("2026-08-03"), day("2026-08-04")];
        expect(zeroRuns(history)).toEqual([]);
    });

    it("reports a run at the minimum length", () => {
        const history = [
            day("2026-08-01"),
            zero("2026-08-02"),
            zero("2026-08-03"),
            zero("2026-08-04"),
            day("2026-08-05"),
        ];
        expect(shape(zeroRuns(history))).toEqual(["2026-08-02..2026-08-04(3)"]);
    });

    it("reports a trailing run that never recovers", () => {
        const history = [day("2026-08-01"), zero("2026-08-02"), zero("2026-08-03"), zero("2026-08-04")];
        expect(shape(zeroRuns(history))).toEqual(["2026-08-02..2026-08-04(3)"]);
    });

    // The point of requireSpendBefore: a dormant or never-activated account would otherwise report
    // its entire history as damage on every scan.
    it("ignores a run with no prior spend", () => {
        const history = [zero("2026-08-01"), zero("2026-08-02"), zero("2026-08-03"), zero("2026-08-04")];
        expect(zeroRuns(history)).toEqual([]);
    });

    it("reports a leading run when asked not to require prior spend", () => {
        const history = [zero("2026-08-01"), zero("2026-08-02"), zero("2026-08-03")];
        expect(shape(zeroRuns(history, MIN_ZERO_RUN, false))).toEqual(["2026-08-01..2026-08-03(3)"]);
    });

    // A zero run cannot vouch for itself: zero days add no spend, so only a real spending day before
    // the run can qualify it.
    it("does not let the run itself satisfy the prior-spend gate", () => {
        const history = [zero("2026-08-01"), zero("2026-08-02"), zero("2026-08-03"), day("2026-08-04")];
        expect(zeroRuns(history)).toEqual([]);
    });

    it("splits a run across a hole in the stored history", () => {
        // 08-04 and 08-05 have no row at all — that is missingDays' business, and merging across them
        // would report one 6-day zero run where there are two short ones (neither long enough).
        const history = [
            day("2026-08-01"),
            zero("2026-08-02"),
            zero("2026-08-03"),
            zero("2026-08-06"),
            zero("2026-08-07"),
        ];
        expect(zeroRuns(history)).toEqual([]);
    });

    it("reports two separate runs", () => {
        const history = [
            day("2026-08-01"),
            zero("2026-08-02"),
            zero("2026-08-03"),
            zero("2026-08-04"),
            day("2026-08-05"),
            zero("2026-08-06"),
            zero("2026-08-07"),
            zero("2026-08-08"),
        ];
        expect(shape(zeroRuns(history))).toEqual(["2026-08-02..2026-08-04(3)", "2026-08-06..2026-08-08(3)"]);
    });

    it("does not treat a day with conversions but no spend as zero", () => {
        const history = [
            day("2026-08-01"),
            zero("2026-08-02"),
            day("2026-08-03", { spend: 0, impressions: 0, clicks: 0, conversions: 2 }),
            zero("2026-08-04"),
        ];
        expect(zeroRuns(history)).toEqual([]);
    });

    it("sorts unordered history before scanning", () => {
        const history = [
            zero("2026-08-04"),
            day("2026-08-01"),
            zero("2026-08-03"),
            zero("2026-08-02"),
            day("2026-08-05"),
        ];
        expect(shape(zeroRuns(history))).toEqual(["2026-08-02..2026-08-04(3)"]);
    });
});

describe("padRanges", () => {
    it("returns nothing for no ranges", () => {
        expect(padRanges([], 1)).toEqual([]);
    });

    it("widens a range on both sides", () => {
        expect(shape(padRanges([{ from: "2026-08-03", to: "2026-08-05", days: 3 }], 1))).toEqual([
            "2026-08-02..2026-08-06(5)",
        ]);
    });

    it("merges ranges that overlap once padded", () => {
        const ranges = [
            { from: "2026-08-03", to: "2026-08-04", days: 2 },
            { from: "2026-08-07", to: "2026-08-08", days: 2 },
        ];
        expect(shape(padRanges(ranges, 1))).toEqual(["2026-08-02..2026-08-09(8)"]);
    });

    // Touching ranges are one Zernio request, not two.
    it("merges ranges that end and begin on consecutive days", () => {
        const ranges = [
            { from: "2026-08-01", to: "2026-08-02", days: 2 },
            { from: "2026-08-03", to: "2026-08-04", days: 2 },
        ];
        expect(shape(padRanges(ranges, 0))).toEqual(["2026-08-01..2026-08-04(4)"]);
    });

    // Unpadded, a one-day hole is a real separation: padRanges merges what TOUCHES after widening,
    // it does not invent tolerance of its own. Pad by 1 and the same pair becomes one range (above).
    it("keeps ranges one day apart separate when not padded", () => {
        const ranges = [
            { from: "2026-08-01", to: "2026-08-02", days: 2 },
            { from: "2026-08-04", to: "2026-08-05", days: 2 },
        ];
        expect(shape(padRanges(ranges, 0))).toEqual(["2026-08-01..2026-08-02(2)", "2026-08-04..2026-08-05(2)"]);
    });

    it("keeps ranges far apart separate", () => {
        const ranges = [
            { from: "2026-08-01", to: "2026-08-02", days: 2 },
            { from: "2026-08-20", to: "2026-08-21", days: 2 },
        ];
        expect(shape(padRanges(ranges, 1))).toEqual(["2026-07-31..2026-08-03(4)", "2026-08-19..2026-08-22(4)"]);
    });

    // A range fully inside another must not truncate it.
    it("keeps the widest end when one range contains another", () => {
        const ranges = [
            { from: "2026-08-01", to: "2026-08-20", days: 20 },
            { from: "2026-08-05", to: "2026-08-06", days: 2 },
        ];
        expect(shape(padRanges(ranges, 0))).toEqual(["2026-08-01..2026-08-20(20)"]);
    });

    it("pads across a month boundary", () => {
        expect(shape(padRanges([{ from: "2026-09-01", to: "2026-09-01", days: 1 }], 1))).toEqual([
            "2026-08-31..2026-09-02(3)",
        ]);
    });
});

describe("totalDays", () => {
    it("sums range lengths", () => {
        expect(
            totalDays([
                { from: "2026-08-01", to: "2026-08-03", days: 3 },
                { from: "2026-08-10", to: "2026-08-10", days: 1 },
            ]),
        ).toBe(4);
    });

    it("is zero for no ranges", () => {
        expect(totalDays([])).toBe(0);
    });
});
