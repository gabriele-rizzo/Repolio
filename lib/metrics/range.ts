import { DAY_MS, MAX_BACKFILL_DAYS } from "@/lib/constants";

// Range validation for the live-metrics endpoint, kept out of the route so it can be tested. The route
// itself (app/api/metrics/route.ts) still owns auth, ownership and per-parameter parsing.

/** Whole UTC days covered by [from, to], both endpoint days included. */
export function spanInDays(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

/**
 * Why a range needs rejecting, or null when it is fine.
 *
 * Two things go wrong that per-parameter parsing cannot see:
 *
 * 1. An INVERTED range. Both dates are individually valid, so parsing passes, but `metricsForWindow`
 *    clamps the resulting negative span to 0 — the caller gets an empty current period and a
 *    zero-length comparison period rather than being told the range was backwards.
 *
 * 2. An UNBOUNDED range. This endpoint is driven by the report page's date picker, and
 *    `metricsForWindow` queries the requested span TWICE (the window, plus the equally long preceding
 *    one for deltas), so the cost is two scans of whatever is asked for. The cap is the data horizon
 *    itself — nothing older than MAX_BACKFILL_DAYS can exist — so no legitimate range is refused.
 */
export function metricsRangeProblem(from: Date, to: Date): string | null {
    if (from.getTime() > to.getTime()) return "'from' must not be after 'to'";
    if (spanInDays(from, to) > MAX_BACKFILL_DAYS) return `Range too large: at most ${MAX_BACKFILL_DAYS} days`;
    return null;
}
