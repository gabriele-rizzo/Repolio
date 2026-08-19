import { getCurrentClient } from "@/actions/auth/authorize";
import { metricsRangeProblem } from "@/lib/metrics/range";
import { metricsForWindow, type WindowMetrics } from "@/lib/metrics/window";
import { getParam } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";

export type MetricsRouteResponse = ResultResponse<WindowMetrics, string>;

export async function GET(request: NextRequest): Promise<MetricsRouteResponse> {
    const client = await getCurrentClient();
    if (!client) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const accountId = getParam("account", request, (v) => Number(v));
    if (accountId == null || !Number.isInteger(accountId)) {
        return NextResponse.json(err("'account' must be a valid id"), { status: 400 });
    }

    const to = getParam("to", request, (v) => new Date(v));
    if (!to || isNaN(to.getTime())) return NextResponse.json(err("'to' must be a valid date"), { status: 400 });

    const from = getParam("from", request, (v) => new Date(v));
    if (!from || isNaN(from.getTime())) return NextResponse.json(err("'from' must be a valid date"), { status: 400 });

    // The dates are each valid; the RANGE they form still may not be. See lib/metrics/range.ts for
    // what goes wrong and why the cap sits where it does.
    const rangeProblem = metricsRangeProblem(from, to);
    if (rangeProblem) return NextResponse.json(err(rangeProblem), { status: 400 });

    // Ownership: the ad account must belong to the current client.
    const account = await prisma.adAccount.findFirst({
        where: { id: accountId, connection: { client_id: client.id } },
        select: { id: true },
    });
    if (!account) return NextResponse.json(err("Account not found"), { status: 404 });

    return NextResponse.json(ok(await metricsForWindow(accountId, from, to)));
}
