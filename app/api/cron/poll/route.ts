import { checkEnv } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
    const header = request.headers.get("authorization");
    const secret = checkEnv("CRON_SECRET");

    if (secret && header !== `bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // const clients = await prisma.client.findMany({ where: { active: true } });

    // get snapshots for every client

    // we check every user's recurrence
    // if it's a report day for a client: we collect every snapshot since the last report and we build the report based on that data
}
