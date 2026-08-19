// Wall-clock budgeting for the cron routes.
//
// WHY THIS EXISTS: Vercel kills a function the instant it hits `maxDuration` (60s on Hobby — see
// app/api/cron/daily/route.ts). The kill is not an exception: nothing unwinds, no catch block runs,
// no error is logged, and whatever had already committed stays committed. So an overrun is not a
// failure the pipeline can observe — it is a silent truncation. The July blackout (see the
// FETCH_CONCURRENCY note in actions/snapshot/collect-snapshots.ts) was exactly this.
//
// A budget bounds how much work a run *starts*. Each unit of work checks in before beginning, and
// once the deadline has passed the rest of the queue is abandoned deliberately — counted, logged and
// recorded — instead of being cut off mid-write by the platform.
//
// WHAT IT CANNOT DO: it bounds starts, not durations. A single client that takes 40s still takes
// 40s, and in-flight work is never cancelled (there is nothing safe to cancel it into). The margin
// below absorbs a normal overshoot; a pathological single unit can still be killed. Bounding that
// would need per-unit timeouts inside the Zernio fetch path, which is a separate change.

/**
 * Total wall clock a cron invocation may spend starting work, in ms.
 *
 * Deliberately below the 60s `maxDuration`: the tail of in-flight work still has to finish after the
 * last start, and the run record has to be written and the response returned inside the same budget.
 * Raise alongside `maxDuration` if this ever moves to Vercel Pro (300s).
 */
export const CRON_BUDGET_MS = Number(process.env.CRON_BUDGET_MS) || 54_000;

/**
 * Wall clock the snapshot phase must leave behind for the report phase in the combined daily job.
 *
 * This is the reason the budget is split rather than shared: report generation is the product, and
 * snapshot collection is merely its input. Without a reservation, snapshots — which scale with total
 * ad accounts — would grow until they consumed the whole invocation, and the poll phase would stop
 * running at all. Clients would then silently miss reporting slots while every snapshot looked
 * healthy, which is the failure mode that is hardest to notice from the outside.
 *
 * Sized for: the `due_clients()` RPC, a back-fill for any due client the snapshot phase skipped, one
 * `Report` insert per due ad account, and one Anthropic batch submit.
 */
export const POLL_RESERVE_MS = Number(process.env.POLL_RESERVE_MS) || 20_000;

export interface Budget {
    /** ms since the budget started. */
    elapsed(): number;
    /** ms until the deadline; never negative. */
    remaining(): number;
    /** True once the deadline has passed. */
    expired(): boolean;
    /**
     * True while there is room to begin another unit of work. `estimateMs` is a floor, not a
     * prediction: passing a rough per-unit cost stops the run from starting work it certainly
     * cannot finish, which is the difference between an abandoned unit and a killed one.
     */
    canStart(estimateMs?: number): boolean;
    /** A budget over the same clock that stops `reserveMs` earlier, leaving that much for later phases. */
    reserving(reserveMs: number): Budget;
}

/**
 * A budget of `totalMs` starting now. `clock` is injectable so the behaviour is testable without
 * waiting in real time.
 */
export function createBudget(totalMs: number, clock: () => number = Date.now): Budget {
    return budgetUntil(clock() + totalMs, clock);
}

function budgetUntil(deadline: number, clock: () => number): Budget {
    const startedAt = clock();

    const remaining = () => Math.max(0, deadline - clock());

    return {
        elapsed: () => clock() - startedAt,
        remaining,
        expired: () => remaining() === 0,
        canStart: (estimateMs = 0) => remaining() > estimateMs,
        reserving: (reserveMs) => budgetUntil(deadline - reserveMs, clock),
    };
}

/** A budget that never expires — for manual runs and tests that shouldn't be time-bounded. */
export function unlimitedBudget(): Budget {
    return {
        elapsed: () => 0,
        remaining: () => Infinity,
        expired: () => false,
        canStart: () => true,
        reserving: () => unlimitedBudget(),
    };
}
