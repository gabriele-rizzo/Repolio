import { extractRowFacts } from "@/lib/metrics/extract";
import { missingZeroFillDates, zeroFillFloor, zeroSnapshotData } from "@/lib/snapshot/zero-fill";
import { describe, expect, it } from "vitest";

// The report's cron fires at 00:45 UTC on Jul 16 — the current (partial) day is 2026-07-16.
const NOW = new Date("2026-07-16T00:45:00.000Z");
const utcMs = (day: string) => Date.parse(`${day}T00:00:00.000Z`);

describe("zeroFillFloor", () => {
    it("caps a gap re-pull to the trailing window, not the whole gap", () => {
        // latest snapshot is weeks old → from is far back, but only the last 3 days zero-fill.
        expect(zeroFillFloor(NOW, new Date("2026-06-20T00:00:00Z"), 3)).toBe(utcMs("2026-07-13"));
    });

    it("clamps to the fetch start so a fresh account never back-fills before it existed", () => {
        // First pull of an account created yesterday: don't invent zeros before creation day.
        expect(zeroFillFloor(NOW, new Date("2026-07-15T09:00:00Z"), 3)).toBe(utcMs("2026-07-15"));
    });

    it("widens with the weekly reconcile window", () => {
        expect(zeroFillFloor(NOW, new Date("2026-01-01T00:00:00Z"), 7)).toBe(utcMs("2026-07-09"));
    });
});

describe("missingZeroFillDates", () => {
    it("returns whole days in the window Zernio didn't return, excluding today", () => {
        const have = new Set(["2026-07-14"]);
        expect(missingZeroFillDates(have, utcMs("2026-07-13"), NOW)).toEqual(["2026-07-13", "2026-07-15"]);
    });

    it("never emits the partial current day even when it's missing", () => {
        expect(missingZeroFillDates(new Set(), utcMs("2026-07-16"), NOW)).toEqual([]);
    });

    it("emits nothing when every covered day is present", () => {
        const have = new Set(["2026-07-13", "2026-07-14", "2026-07-15"]);
        expect(missingZeroFillDates(have, utcMs("2026-07-13"), NOW)).toEqual([]);
    });
});

describe("zeroSnapshotData", () => {
    it("is an all-zero, no-conversion day that adds nothing to KPIs", () => {
        const d = zeroSnapshotData("2026-07-15", "USD");
        expect(d).toMatchObject({ date: "2026-07-15", currency: "USD", spend: 0, impressions: 0 });

        const facts = extractRowFacts("META", d);
        expect(facts.purchases).toBe(0);
        expect(facts.leads).toBe(0);
        expect(facts.revenue).toBeNull(); // unmeasured, never a fake 0
        expect(facts.linkClicks).toBeNull();
    });
});
