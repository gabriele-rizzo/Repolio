import { runPoll } from "@/lib/cron/poll";
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
export async function GET(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (!isAuthorizedCron(request)) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const snapshots = await runSnapshots();
    if (snapshots.error) console.error("daily: snapshot phase failed:", snapshots.error);

    const poll = await runPoll();
    if (poll.error) return NextResponse.json(err(poll.error), { status: poll.status });

    return new NextResponse(null);
}
