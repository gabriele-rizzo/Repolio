import { MAX_BACKFILL_DAYS } from "@/lib/constants";
import { metricsRangeProblem, spanInDays } from "@/lib/metrics/range";
import { describe, expect, it } from "vitest";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** A range ending 2026-01-30 that covers exactly `days` whole UTC days. */
const rangeOf = (days: number) => {
    const to = day("2026-01-30");
    return { from: new Date(to.getTime() - (days - 1) * 86_400_000), to };
};

describe("spanInDays", () => {
    it("counts both endpoint days", () => {
        expect(spanInDays(day("2026-01-01"), day("2026-01-01"))).toBe(1);
        expect(spanInDays(day("2026-01-01"), day("2026-01-02"))).toBe(2);
        expect(spanInDays(day("2026-01-01"), day("2026-01-31"))).toBe(31);
    });

    it("ignores the time of day within the endpoints", () => {
        // The picker sends whatever the browser produced; the window itself floors to UTC days.
        expect(spanInDays(new Date("2026-01-01T23:59:00Z"), new Date("2026-01-02T00:01:00Z"))).toBe(1);
    });
});

describe("metricsRangeProblem", () => {
    it("accepts an ordinary window", () => {
        expect(metricsRangeProblem(day("2026-01-01"), day("2026-01-31"))).toBeNull();
    });

    it("accepts a single day", () => {
        expect(metricsRangeProblem(day("2026-01-15"), day("2026-01-15"))).toBeNull();
    });

    it("rejects an inverted range instead of silently returning nothing", () => {
        // Both dates parse, so nothing upstream catches this; metricsForWindow would clamp the negative
        // span to zero and hand back an empty period as though that were the answer.
        expect(metricsRangeProblem(day("2026-01-31"), day("2026-01-01"))).toBe("'from' must not be after 'to'");
    });

    it("accepts a window exactly at the data horizon", () => {
        // The cap must not refuse the longest range that can legitimately hold data.
        expect(metricsRangeProblem(rangeOf(MAX_BACKFILL_DAYS).from, rangeOf(MAX_BACKFILL_DAYS).to)).toBeNull();
    });

    it("rejects a window one day past the horizon", () => {
        const { from, to } = rangeOf(MAX_BACKFILL_DAYS + 1);
        expect(metricsRangeProblem(from, to)).toBe(`Range too large: at most ${MAX_BACKFILL_DAYS} days`);
    });

    it("rejects an absurd range without doing any work for it", () => {
        expect(metricsRangeProblem(day("1970-01-01"), day("2099-12-31"))).toMatch(/Range too large/);
    });

    it("reports the inversion first when a range is both backwards and enormous", () => {
        // Backwards is the more specific diagnosis, and a negative span is not "too large".
        expect(metricsRangeProblem(day("2099-12-31"), day("1970-01-01"))).toBe("'from' must not be after 'to'");
    });
});
