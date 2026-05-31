import { authorize } from "@/actions/auth/authorize";
import type { Platform, Report } from "@/generated/prisma/browser";
import { getParam } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";

export type ReportSnapshotPreview = { start_date: Date; platform: Platform };
export type ReportWithSnapshots = Report & { snapshots: ReportSnapshotPreview[] };
type ReportRouteResponse = ResultResponse<ReportWithSnapshots[], string>;

export async function GET(request: NextRequest): Promise<ReportRouteResponse> {
    const client = await authorize();
    if (!client) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const end_date = getParam("to", request, (v) => new Date(v));
    if (!end_date) return NextResponse.json(err("'to' param is required"), { status: 400 });

    const start_date = getParam("from", request, (v) => new Date(v));
    const clientMatch = { ad_account: { connection: { client_id: client.id } } };
    const snapshotMatch = start_date ? { ...clientMatch, start_date: { gte: start_date } } : clientMatch;

    const data = await prisma.report.findMany({
        where: { snapshots: { some: snapshotMatch }, created_at: { lte: end_date } },
        orderBy: { created_at: "desc" },
        include: {
            snapshots: {
                select: { start_date: true, platform: true },
                orderBy: { start_date: "asc" },
            },
        },
    });

    return NextResponse.json(ok(data));
}
