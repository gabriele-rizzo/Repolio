import { runCollect } from "@/lib/cron/collect";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { err } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";

// Collect phase of report generation: retrieve finished Anthropic batches and write the AI sections
// back. The work itself lives in lib/cron/collect.ts, so the admin validation screen can run the same
// pass on demand. Runs hourly — batches usually finish within an hour (max 24h).
//
// This route does NOT notify or email anyone. A finished report waits in its client's ReportBatch
// until an admin validates it at /admin/validation.

// Retrieving + writing back every finished batch overruns the 10s default budget; 60s is the
// Hobby ceiling. Keep in sync with the other cron routes.
export const maxDuration = 60;

// Vercel Cron invokes via GET.
export async function GET(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (!isAuthorizedCron(request)) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const { pending } = await runCollect();
    if (pending === 0) return new NextResponse(null, { status: 204 });

    return new NextResponse(null);
}
