import { phaseCounts } from "@/lib/cron/phase-detail";
import { describe, expect, it } from "vitest";

describe("phaseCounts", () => {
    // The row that motivated this: 2026-09-01's daily run, clean at the top level, one failed client
    // in the report phase. Reading only the top-level counts rendered it as "ok".
    it("reads the report phase out of a real daily detail", () => {
        const detail = {
            snapshots: { considered: 2, processed: 2, failed: 0, skipped: 0 },
            poll: { failed: 1, skipped: 0, processed: 0, considered: 1 },
            budget_ms: 54000,
            poll_reserve_ms: 20000,
        };

        expect(phaseCounts(detail, "poll")).toEqual({ considered: 1, processed: 0, failed: 1, skipped: 0 });
        expect(phaseCounts(detail, "snapshots")).toEqual({ considered: 2, processed: 2, failed: 0, skipped: 0 });
    });

    it("returns null when the phase is absent", () => {
        expect(phaseCounts({ snapshots: { considered: 1 } }, "poll")).toBeNull();
    });

    it("returns null for a detail that is missing, scalar or an array", () => {
        expect(phaseCounts(null, "poll")).toBeNull();
        expect(phaseCounts(undefined, "poll")).toBeNull();
        expect(phaseCounts("poll", "poll")).toBeNull();
        expect(phaseCounts(42, "poll")).toBeNull();
        expect(phaseCounts([{ poll: { considered: 1 } }], "poll")).toBeNull();
    });

    it("returns null when the phase holds no recognisable count", () => {
        // A future shape under the same key must read as "cannot tell", not as a phase that ran
        // cleanly — 0/0/0/0 on a health page is indistinguishable from success.
        expect(phaseCounts({ poll: { reason: "skipped, no due clients" } }, "poll")).toBeNull();
        expect(phaseCounts({ poll: {} }, "poll")).toBeNull();
        expect(phaseCounts({ poll: [1, 2] }, "poll")).toBeNull();
    });

    it("fills in the keys a partial or malformed phase omits", () => {
        expect(phaseCounts({ poll: { considered: 3 } }, "poll")).toEqual({
            considered: 3,
            processed: 0,
            failed: 0,
            skipped: 0,
        });

        // JSON can hold anything; a string count must not propagate into arithmetic downstream.
        expect(phaseCounts({ poll: { considered: 3, processed: "2", failed: null, skipped: NaN } }, "poll")).toEqual({
            considered: 3,
            processed: 0,
            failed: 0,
            skipped: 0,
        });
    });
});
