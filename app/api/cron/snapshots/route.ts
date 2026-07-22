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

    const { status, error } = await runSnapshots();
    if (error) return NextResponse.json(err(error), { status });

    return new NextResponse(null, { status });
}
