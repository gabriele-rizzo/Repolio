import { createBudget, unlimitedBudget } from "@/lib/cron/budget";
import { describe, expect, it } from "vitest";

/** A controllable clock — the budget takes one precisely so these tests need no real waiting. */
function fakeClock(start = 1_000_000) {
    let now = start;
    return {
        now: () => now,
        advance: (ms: number) => {
            now += ms;
        },
    };
}

describe("createBudget", () => {
    it("reports elapsed and remaining against the injected clock", () => {
        const clock = fakeClock();
        const budget = createBudget(10_000, clock.now);

        expect(budget.elapsed()).toBe(0);
        expect(budget.remaining()).toBe(10_000);

        clock.advance(4_000);
        expect(budget.elapsed()).toBe(4_000);
        expect(budget.remaining()).toBe(6_000);
    });

    it("clamps remaining at zero instead of going negative", () => {
        const clock = fakeClock();
        const budget = createBudget(1_000, clock.now);

        clock.advance(5_000);
        expect(budget.remaining()).toBe(0);
        expect(budget.elapsed()).toBe(5_000);
    });

    it("expires exactly at the deadline, not after it", () => {
        const clock = fakeClock();
        const budget = createBudget(1_000, clock.now);

        clock.advance(999);
        expect(budget.expired()).toBe(false);

        clock.advance(1);
        expect(budget.expired()).toBe(true);
    });

    it("allows starting work while time remains and refuses once expired", () => {
        const clock = fakeClock();
        const budget = createBudget(1_000, clock.now);

        expect(budget.canStart()).toBe(true);
        clock.advance(1_000);
        expect(budget.canStart()).toBe(false);
    });

    it("refuses work whose estimated cost exceeds what is left", () => {
        const clock = fakeClock();
        const budget = createBudget(10_000, clock.now);

        // 3s of work with 10s left: fine.
        expect(budget.canStart(3_000)).toBe(true);

        clock.advance(8_000);
        // Same 3s of work with 2s left: refused before it can be killed mid-flight.
        expect(budget.canStart(3_000)).toBe(false);
        // Something cheap still fits.
        expect(budget.canStart(500)).toBe(true);
    });
});

describe("reserving", () => {
    it("stops the derived budget earlier, leaving the reservation for later phases", () => {
        const clock = fakeClock();
        const whole = createBudget(60_000, clock.now);
        const phase = whole.reserving(20_000);

        expect(phase.remaining()).toBe(40_000);
        expect(whole.remaining()).toBe(60_000);
    });

    it("expires the phase while the parent still has the reservation left", () => {
        const clock = fakeClock();
        const whole = createBudget(60_000, clock.now);
        const phase = whole.reserving(20_000);

        clock.advance(40_000);

        // This is the property the daily job depends on: a snapshot phase that runs long is cut off
        // with the poll reservation still intact, so report generation always gets its slice.
        expect(phase.expired()).toBe(true);
        expect(whole.expired()).toBe(false);
        expect(whole.remaining()).toBe(20_000);
    });

    it("hands unused phase time back to the parent rather than wasting it", () => {
        const clock = fakeClock();
        const whole = createBudget(60_000, clock.now);
        const phase = whole.reserving(20_000);

        // Snapshots finished in 5s instead of the 40s they were allowed.
        clock.advance(5_000);
        expect(phase.expired()).toBe(false);
        // Poll inherits 55s, not the 20s reservation.
        expect(whole.remaining()).toBe(55_000);
    });

    it("nests, and a zero reservation is a no-op", () => {
        const clock = fakeClock();
        const whole = createBudget(60_000, clock.now);

        expect(whole.reserving(0).remaining()).toBe(60_000);
        expect(whole.reserving(10_000).reserving(20_000).remaining()).toBe(30_000);
    });

    it("yields an already-expired budget when the reservation exceeds the total", () => {
        const clock = fakeClock();
        const whole = createBudget(10_000, clock.now);
        const phase = whole.reserving(15_000);

        // Misconfigured (POLL_RESERVE_MS > CRON_BUDGET_MS) must degrade to "start nothing", never to
        // a negative window that reads as time available.
        expect(phase.remaining()).toBe(0);
        expect(phase.expired()).toBe(true);
        expect(phase.canStart()).toBe(false);
    });
});

describe("unlimitedBudget", () => {
    it("never expires and always permits work, at any estimated cost", () => {
        const budget = unlimitedBudget();

        expect(budget.expired()).toBe(false);
        expect(budget.remaining()).toBe(Infinity);
        expect(budget.canStart()).toBe(true);
        expect(budget.canStart(Number.MAX_SAFE_INTEGER)).toBe(true);
        expect(budget.reserving(999_999).canStart()).toBe(true);
    });
});
