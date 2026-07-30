import { currentSlot, isDue, normalizeNdays, upcomingSlots } from "@/lib/recurrence/schedule";
import { describe, expect, it } from "vitest";

/** A UTC-midnight date from a YYYY-MM-DD day string, matching how anchors are stored. */
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date): string => d.toISOString().slice(0, 10);

// Anchored to Saturday 1 August 2026 — the case that motivated the feature: a weekly client whose
// reports must always land on a Saturday.
const SATURDAY = day("2026-08-01");

describe("normalizeNdays", () => {
    it("defaults when missing or unusable", () => {
        expect(normalizeNdays(null)).toBe(30);
        expect(normalizeNdays(undefined)).toBe(30);
        expect(normalizeNdays(NaN)).toBe(30);
    });

    it("floors fractional cadences and clamps to bounds", () => {
        expect(normalizeNdays(7.9)).toBe(7);
        expect(normalizeNdays(0)).toBe(1);
        expect(normalizeNdays(-5)).toBe(1);
        expect(normalizeNdays(10_000)).toBe(365);
    });
});

describe("currentSlot", () => {
    it("is null before the schedule starts", () => {
        expect(currentSlot(SATURDAY, 7, day("2026-07-31"))).toBeNull();
    });

    it("is the anchor itself on the anchor day", () => {
        expect(iso(currentSlot(SATURDAY, 7, SATURDAY)!)).toBe("2026-08-01");
    });

    it("holds the slot until the next one is reached", () => {
        expect(iso(currentSlot(SATURDAY, 7, day("2026-08-05"))!)).toBe("2026-08-01");
        expect(iso(currentSlot(SATURDAY, 7, day("2026-08-07"))!)).toBe("2026-08-01");
        expect(iso(currentSlot(SATURDAY, 7, day("2026-08-08"))!)).toBe("2026-08-08");
    });

    it("stays on the anchor's weekday across many cycles", () => {
        // 10 weeks out, still a Saturday (getUTCDay 6).
        const slot = currentSlot(SATURDAY, 7, day("2026-10-12"))!;
        expect(slot.getUTCDay()).toBe(6);
        expect(iso(slot)).toBe("2026-10-10");
    });

    it("returns only the latest reached slot for an anchor far in the past", () => {
        // Anchored 1 July, asked on 30 July: the answer is the 29th, not a backlog of every Wednesday.
        expect(iso(currentSlot(day("2026-07-01"), 7, day("2026-07-30"))!)).toBe("2026-07-29");
    });
});

describe("upcomingSlots", () => {
    it("starts at the anchor when asked from before it", () => {
        expect(upcomingSlots(SATURDAY, 7, day("2026-07-20"), 3).map(iso)).toEqual([
            "2026-08-01",
            "2026-08-08",
            "2026-08-15",
        ]);
    });

    it("includes today when today is itself a slot", () => {
        expect(upcomingSlots(SATURDAY, 7, SATURDAY, 2).map(iso)).toEqual(["2026-08-01", "2026-08-08"]);
    });

    it("skips past slots when asked mid-cycle", () => {
        expect(upcomingSlots(SATURDAY, 7, day("2026-08-04"), 2).map(iso)).toEqual(["2026-08-08", "2026-08-15"]);
    });

    it("handles a monthly cadence", () => {
        expect(upcomingSlots(SATURDAY, 30, SATURDAY, 3).map(iso)).toEqual(["2026-08-01", "2026-08-31", "2026-09-30"]);
    });

    it("returns nothing for a non-positive count", () => {
        expect(upcomingSlots(SATURDAY, 7, SATURDAY, 0)).toEqual([]);
    });
});

describe("isDue", () => {
    it("is not due before the anchor, even with no reports", () => {
        expect(isDue(SATURDAY, 7, day("2026-07-31"), null)).toBe(false);
    });

    it("is due on the anchor day for a client with no reports", () => {
        expect(isDue(SATURDAY, 7, SATURDAY, null)).toBe(true);
    });

    it("fires once for an anchor in the past rather than repeatedly", () => {
        const anchor = day("2026-07-01");
        expect(isDue(anchor, 7, day("2026-07-30"), null)).toBe(true);
        // Having reported on the 30th satisfies the 29th's slot; the next slot is 5 August.
        expect(isDue(anchor, 7, day("2026-07-31"), day("2026-07-30"))).toBe(false);
        expect(isDue(anchor, 7, day("2026-08-04"), day("2026-07-30"))).toBe(false);
        expect(isDue(anchor, 7, day("2026-08-05"), day("2026-07-30"))).toBe(true);
    });

    it("is not due again within the same cycle", () => {
        expect(isDue(SATURDAY, 7, day("2026-08-03"), SATURDAY)).toBe(false);
        expect(isDue(SATURDAY, 7, day("2026-08-07"), SATURDAY)).toBe(false);
    });

    it("comes due on the next slot", () => {
        expect(isDue(SATURDAY, 7, day("2026-08-08"), SATURDAY)).toBe(true);
    });

    it("still owes a missed slot the day after, then recovers the weekday", () => {
        // The 15 Aug run never happened; on the 16th the slot is still unmet.
        expect(isDue(SATURDAY, 7, day("2026-08-16"), day("2026-08-08"))).toBe(true);

        // Having caught up late on the 16th, the next due day is the anchor's slot — Saturday 22nd —
        // NOT the 16th + 7. A late run must not drag the schedule off its weekday.
        expect(isDue(SATURDAY, 7, day("2026-08-21"), day("2026-08-16"))).toBe(false);
        expect(isDue(SATURDAY, 7, day("2026-08-22"), day("2026-08-16"))).toBe(true);
        expect(day("2026-08-22").getUTCDay()).toBe(6);
    });

    it("does not double-report when a report lands ahead of its slot", () => {
        // A manually generated report dated after the current slot leaves nothing owed.
        expect(isDue(SATURDAY, 7, day("2026-08-09"), day("2026-08-09"))).toBe(false);
    });

    it("treats a daily cadence as due every day", () => {
        expect(isDue(SATURDAY, 1, day("2026-08-02"), SATURDAY)).toBe(true);
        expect(isDue(SATURDAY, 1, SATURDAY, SATURDAY)).toBe(false);
    });
});
