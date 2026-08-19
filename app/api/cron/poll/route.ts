import { CRON_BUDGET_MS, createBudget } from "@/lib/cron/budget";
import { runPoll } from "@/lib/cron/poll";
import { startCronRun } from "@/lib/cron/run-record";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { err } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";

// Standalone submit phase of report generation. The scheduled invocation currently runs through
// /api/cron/daily (snapshots + poll in one job) to fit Vercel Hobby's 2-cron limit; this route
// stays live so report generation can be triggered independently and so reverting to 3 separate
// crons is a one-line vercel.json change. Vercel Cron invokes via GET.

// Self-heal snapshot back-fill + an Anthropic Batches submit overrun the 10s default budget; 60s
// is the Hobby ceiling. Keep in sync with /api/cron/daily.
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (!isAuthorizedCron(request)) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const finish = await startCronRun("poll");
    const { status, error, counts } = await runPoll(createBudget(CRON_BUDGET_MS));
    await finish(counts);

    if (error) return NextResponse.json(err(error), { status });

    return new NextResponse(null, { status });
}
