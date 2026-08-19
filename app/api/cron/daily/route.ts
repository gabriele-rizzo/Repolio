import { CRON_BUDGET_MS, POLL_RESERVE_MS, createBudget } from "@/lib/cron/budget";
import { runPoll } from "@/lib/cron/poll";
import { emptyCounts, startCronRun } from "@/lib/cron/run-record";
import { runSnapshots } from "@/lib/cron/snapshots";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { err } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";

// Combined daily job: snapshot collection followed by the report submit phase, in one invocation.
// This exists to fit Vercel Hobby's limits (max 2 crons, each triggered at most once/day), which
// leaves only one slot for the hourly-by-design collect job. See vercel.json.
//
// TO REVERT TO 3 SEPARATE CRONS: point vercel.json's crons at /api/cron/snapshots (0 0 * * *),
// /api/cron/poll (0 2 * * *) and /api/cron/collect (0 * * * *) — all three routes are still live —
// and delete this file. Requires the Vercel Pro plan for the hourly collect cron.
//
// Ordering: snapshots runs first so poll sees fresh data; poll also self-heals any missing
// snapshots, so a snapshot-phase failure is logged but does not block report generation.
// Vercel Cron invokes via GET.

// This route does real work per invocation: a Zernio timeline fetch per ad account (fanned out,
// each with retry+backoff on throttling) followed by the report submit phase. On Vercel the
// default function budget is 10s (Hobby) — far too short once a client has a dozen-plus accounts,
// so the function was being KILLED mid-run and committed nothing for the slower clients. 60s is
// the Hobby ceiling; raise to 300 if this ever moves to Pro. See vercel.json.
//
// 60s is a ceiling, not a guarantee, and raising it only moves the cliff: total work grows with
// clients × ad accounts, so any fixed limit is eventually exceeded. What matters is HOW it is
// exceeded. A platform kill at maxDuration unwinds nothing and logs nothing — the run just stops,
// mid-write, and the clients at the back of the queue are silently skipped with every snapshot
// looking healthy. So the phases run against an explicit wall-clock budget (lib/cron/budget.ts) that
// is deliberately shorter than this limit: work that cannot be started in time is abandoned on
// purpose, counted, and recorded (lib/cron/run-record.ts), and the deferred clients sort to the front
// of the next run. Truncation becomes a visible, self-correcting event instead of an invisible one.
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (!isAuthorizedCron(request)) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const finish = await startCronRun("daily");
    const budget = createBudget(CRON_BUDGET_MS);

    // The snapshot phase gets the budget MINUS the poll reservation, so it can never grow into the
    // slice report generation needs. Poll then gets whatever is actually left, which is at least the
    // reservation. Time snapshots don't use is inherited by poll rather than wasted.
    let snapshotCounts = emptyCounts();

    // Snapshots must never abort the run: a thrown snapshot phase would 500 the whole job and skip
    // poll (which self-heals missing snapshots anyway). runSnapshots already returns a Result, but
    // guard the throw path too so one unexpected rejection can't blackout report generation.
    try {
        const snapshots = await runSnapshots(budget.reserving(POLL_RESERVE_MS));
        snapshotCounts = snapshots.counts;
        if (snapshots.error) console.error("daily: snapshot phase failed:", snapshots.error);
    } catch (error) {
        console.error("daily: snapshot phase threw:", error);
    }

    const poll = await runPoll(budget);

    // Both phases in one row. considered/processed/failed describe the snapshot phase — the unit of
    // work that scales with client count — while `skipped` sums BOTH phases, so a single
    // `skipped > 0` is the whole run's "it started shedding work" signal regardless of which phase
    // ran long. `detail` keeps the phases apart for diagnosis.
    await finish(
        {
            considered: snapshotCounts.considered,
            processed: snapshotCounts.processed,
            failed: snapshotCounts.failed,
            skipped: snapshotCounts.skipped + poll.counts.skipped,
        },
        { snapshots: snapshotCounts, poll: poll.counts, budget_ms: CRON_BUDGET_MS, poll_reserve_ms: POLL_RESERVE_MS },
    );

    if (poll.error) return NextResponse.json(err(poll.error), { status: poll.status });

    return new NextResponse(null);
}
