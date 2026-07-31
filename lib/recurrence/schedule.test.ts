import {
    currentSlot,
    isDue,
    monthlySlot,
    normalizeDayOfMonth,
    normalizeMonthInterval,
    normalizeNdays,
    toSchedule,
    upcomingSlots,
    type Schedule,
} from "@/lib/recurrence/schedule";
import { describe, expect, it } from "vitest";

/** A UTC-midnight date from a YYYY-MM-DD day string, matching how anchors are stored. */
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const iso = (d: Date): string => d.toISOString().slice(0, 10);

const interval = (anchor: string, ndays: number): Schedule => ({
    mode: "INTERVAL",
    anchor: day(anchor),
    ndays,
    dayOfMonth: 1,
    monthInterval: 1,
});

const monthly = (anchor: string, dayOfMonth: number, monthInterval = 1): Schedule => ({
    mode: "MONTHLY",
    anchor: day(anchor),
    ndays: 30,
    dayOfMonth,
    monthInterval,
});

// Anchored to Saturday 1 August 2026 — the case that motivated interval mode: a weekly client whose
// reports must always land on a Saturday.
const SATURDAY = "2026-08-01";

describe("normalisation", () => {
    it("clamps the cadence to whole days in range", () => {
        expect(normalizeNdays(null)).toBe(30);
        expect(normalizeNdays(7.9)).toBe(7);
        expect(normalizeNdays(0)).toBe(1);
        expect(normalizeNdays(10_000)).toBe(365);
    });

    it("clamps day-of-month to 1–31", () => {
        expect(normalizeDayOfMonth(null)).toBe(1);
        expect(normalizeDayOfMonth(0)).toBe(1);
        expect(normalizeDayOfMonth(99)).toBe(31);
        expect(normalizeDayOfMonth(15.7)).toBe(15);
    });

    it("clamps the month interval to 1–12", () => {
        expect(normalizeMonthInterval(null)).toBe(1);
        expect(normalizeMonthInterval(0)).toBe(1);
        expect(normalizeMonthInterval(99)).toBe(12);
    });

    it("builds a schedule from raw columns, defaulting the anchor to the client's signup", () => {
        const s = toSchedule({ mode: "MONTHLY", day_of_month: 15, month_interval: 3 }, day("2026-01-10"));
        expect(s.mode).toBe("MONTHLY");
        expect(iso(s.anchor)).toBe("2026-01-10");
        expect(s.dayOfMonth).toBe(15);
        expect(s.monthInterval).toBe(3);
    });

    it("treats an unknown mode as INTERVAL", () => {
        expect(toSchedule({ mode: "WEIRD" }, day("2026-01-01")).mode).toBe("INTERVAL");
        expect(toSchedule(null, day("2026-01-01")).mode).toBe("INTERVAL");
    });
});

describe("monthlySlot", () => {
    it("lands on the requested day", () => {
        expect(iso(monthlySlot(day("2026-01-10"), 0, 1))).toBe("2026-01-01");
        expect(iso(monthlySlot(day("2026-01-10"), 1, 15))).toBe("2026-02-15");
    });

    /** Clamping is what makes "the 31st" mean "the last day" in every month, February included. */
    it("clamps to the length of that month", () => {
        expect(iso(monthlySlot(day("2026-01-01"), 1, 31))).toBe("2026-02-28");
        expect(iso(monthlySlot(day("2026-01-01"), 3, 31))).toBe("2026-04-30");
        expect(iso(monthlySlot(day("2026-01-01"), 0, 31))).toBe("2026-01-31");
    });

    it("handles a leap February", () => {
        expect(iso(monthlySlot(day("2028-01-01"), 1, 31))).toBe("2028-02-29");
    });

    it("crosses year boundaries in both directions", () => {
        expect(iso(monthlySlot(day("2026-12-01"), 1, 1))).toBe("2027-01-01");
        expect(iso(monthlySlot(day("2026-01-01"), -1, 1))).toBe("2025-12-01");
    });
});

describe("currentSlot — interval", () => {
    it("is null before the schedule starts", () => {
        expect(currentSlot(interval(SATURDAY, 7), day("2026-07-31"))).toBeNull();
    });

    it("holds the slot until the next one is reached", () => {
        expect(iso(currentSlot(interval(SATURDAY, 7), day("2026-08-07"))!)).toBe("2026-08-01");
        expect(iso(currentSlot(interval(SATURDAY, 7), day("2026-08-08"))!)).toBe("2026-08-08");
    });

    it("stays on the anchor's weekday across many cycles", () => {
        const slot = currentSlot(interval(SATURDAY, 7), day("2026-10-12"))!;
        expect(slot.getUTCDay()).toBe(6);
        expect(iso(slot)).toBe("2026-10-10");
    });
});

describe("currentSlot — monthly", () => {
    it("returns this month's day once it has been reached", () => {
        expect(iso(currentSlot(monthly("2026-01-01", 1), day("2026-09-05"))!)).toBe("2026-09-01");
    });

    it("falls back to last month when this month's day is still ahead", () => {
        expect(iso(currentSlot(monthly("2026-01-01", 15), day("2026-09-05"))!)).toBe("2026-08-15");
    });

    it("is exactly on the day itself", () => {
        expect(iso(currentSlot(monthly("2026-01-01", 15), day("2026-09-15"))!)).toBe("2026-09-15");
    });

    /**
     * The schedule starts at the anchor. Anchoring mid-month on "the 1st" must not fire retroactively
     * for the 1st that already passed before the client was even scheduled.
     */
    it("never returns a slot before the anchor", () => {
        expect(currentSlot(monthly("2026-08-10", 1), day("2026-08-20"))).toBeNull();
        expect(iso(currentSlot(monthly("2026-08-10", 1), day("2026-09-01"))!)).toBe("2026-09-01");
    });

    it("honours a quarterly interval", () => {
        const q = monthly("2026-01-01", 1, 3);
        expect(iso(currentSlot(q, day("2026-01-01"))!)).toBe("2026-01-01");
        expect(iso(currentSlot(q, day("2026-03-31"))!)).toBe("2026-01-01");
        expect(iso(currentSlot(q, day("2026-04-01"))!)).toBe("2026-04-01");
        expect(iso(currentSlot(q, day("2026-09-05"))!)).toBe("2026-07-01");
    });

    it("clamps the last-day schedule to each month", () => {
        const last = monthly("2026-01-01", 31);
        expect(iso(currentSlot(last, day("2026-02-28"))!)).toBe("2026-02-28");
        expect(iso(currentSlot(last, day("2026-03-30"))!)).toBe("2026-02-28");
        expect(iso(currentSlot(last, day("2026-03-31"))!)).toBe("2026-03-31");
    });
});

describe("upcomingSlots", () => {
    it("lists interval slots from the anchor", () => {
        expect(upcomingSlots(interval(SATURDAY, 7), day("2026-07-20"), 3).map(iso)).toEqual([
            "2026-08-01",
            "2026-08-08",
            "2026-08-15",
        ]);
    });

    it("lists monthly slots, including today when today is one", () => {
        expect(upcomingSlots(monthly("2026-01-01", 1), day("2026-09-01"), 3).map(iso)).toEqual([
            "2026-09-01",
            "2026-10-01",
            "2026-11-01",
        ]);
    });

    it("skips a monthly slot that has already passed this month", () => {
        expect(upcomingSlots(monthly("2026-01-01", 15), day("2026-09-20"), 2).map(iso)).toEqual([
            "2026-10-15",
            "2026-11-15",
        ]);
    });

    it("lists quarterly slots", () => {
        expect(upcomingSlots(monthly("2026-01-01", 1, 3), day("2026-05-01"), 3).map(iso)).toEqual([
            "2026-07-01",
            "2026-10-01",
            "2027-01-01",
        ]);
    });

    it("previews the last-day schedule with each month's real length", () => {
        expect(upcomingSlots(monthly("2026-01-01", 31), day("2026-01-15"), 4).map(iso)).toEqual([
            "2026-01-31",
            "2026-02-28",
            "2026-03-31",
            "2026-04-30",
        ]);
    });

    it("starts a monthly schedule at the anchor, not before it", () => {
        expect(upcomingSlots(monthly("2026-08-10", 1), day("2026-08-10"), 2).map(iso)).toEqual([
            "2026-09-01",
            "2026-10-01",
        ]);
    });

    it("returns nothing for a non-positive count", () => {
        expect(upcomingSlots(monthly("2026-01-01", 1), day("2026-01-01"), 0)).toEqual([]);
    });
});

describe("isDue", () => {
    it("fires on the anchor for a client with no reports", () => {
        expect(isDue(interval(SATURDAY, 7), day(SATURDAY), null)).toBe(true);
    });

    it("is not due again within the same cycle", () => {
        expect(isDue(interval(SATURDAY, 7), day("2026-08-07"), day(SATURDAY))).toBe(false);
        expect(isDue(interval(SATURDAY, 7), day("2026-08-08"), day(SATURDAY))).toBe(true);
    });

    it("still owes a missed slot the day after, then recovers the weekday", () => {
        expect(isDue(interval(SATURDAY, 7), day("2026-08-16"), day("2026-08-08"))).toBe(true);
        // Having caught up late on the 16th, the next due day is the anchor's slot — Saturday 22nd.
        expect(isDue(interval(SATURDAY, 7), day("2026-08-21"), day("2026-08-16"))).toBe(false);
        expect(isDue(interval(SATURDAY, 7), day("2026-08-22"), day("2026-08-16"))).toBe(true);
    });

    it("fires monthly on the day and not again until the next month", () => {
        const s = monthly("2026-01-01", 1);
        expect(isDue(s, day("2026-09-01"), day("2026-08-01"))).toBe(true);
        expect(isDue(s, day("2026-09-02"), day("2026-09-01"))).toBe(false);
        expect(isDue(s, day("2026-09-30"), day("2026-09-01"))).toBe(false);
        expect(isDue(s, day("2026-10-01"), day("2026-09-01"))).toBe(true);
    });

    it("still owes a missed monthly slot, without double-firing once caught up", () => {
        const s = monthly("2026-01-01", 1);
        // The 1 September run never happened; on the 3rd it is still owed.
        expect(isDue(s, day("2026-09-03"), day("2026-08-01"))).toBe(true);
        // Caught up late on the 3rd — nothing more until October.
        expect(isDue(s, day("2026-09-04"), day("2026-09-03"))).toBe(false);
        expect(isDue(s, day("2026-10-01"), day("2026-09-03"))).toBe(true);
    });

    it("does not fire a monthly schedule before its anchor", () => {
        expect(isDue(monthly("2026-08-10", 1), day("2026-08-20"), null)).toBe(false);
        expect(isDue(monthly("2026-08-10", 1), day("2026-09-01"), null)).toBe(true);
    });
});
