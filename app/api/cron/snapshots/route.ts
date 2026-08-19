import { CRON_BUDGET_MS, createBudget } from "@/lib/cron/budget";
import { startCronRun } from "@/lib/cron/run-record";
import { runSnapshots } from "@/lib/cron/snapshots";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { err } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";

// Standalone daily snapshot collection. The scheduled invocation currently runs through
// /api/cron/daily (snapshots + poll in one job) to fit Vercel Hobby's 2-cron limit; this route
// stays live so snapshots can be triggered independently and so reverting to 3 separate crons is a
// one-line vercel.json change. Vercel Cron invokes via GET.

// Per-account Zernio fetches fanned out with retry+backoff overrun the 10s default budget once a
// client has many accounts; 60s is the Hobby ceiling. Keep in sync with /api/cron/daily.
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (!isAuthorizedCron(request)) return NextResponse.json(err("Unauthorized"), { status: 401 });

    // Standalone, so the whole budget is this phase's — no reservation for a following poll.
    const finish = await startCronRun("snapshots");
    const { status, error, counts } = await runSnapshots(createBudget(CRON_BUDGET_MS));
    await finish(counts);

    if (error) return NextResponse.json(err(error), { status });

    return new NextResponse(null, { status });
}
