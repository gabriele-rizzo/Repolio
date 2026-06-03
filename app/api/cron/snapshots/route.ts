import { collectSnapshots } from "@/actions/snapshot/collect-snapshots";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { err, settle } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";
import pLimit from "p-limit";

// Daily snapshot collection for every active client. Split from report generation (/api/cron/poll)
// so each job gets its own execution-time budget and neither can push the other past the limit.

const limit = pLimit(10);

export async function POST(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (!isAuthorizedCron(request)) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const clients = await prisma.client.findMany({ where: { active: true } });

    const result = settle("snapshots", await Promise.all(clients.map((c) => limit(() => collectSnapshots(c)))));
    if (result.error) return NextResponse.json(err(result.error), { status: 500 });

    return new NextResponse(null);
}
