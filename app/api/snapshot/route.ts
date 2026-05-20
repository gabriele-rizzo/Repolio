import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    const client = await authorize();
    if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await prisma.snapshot.findMany({
        where: { client_id: client.id },
        orderBy: { start_date: "desc" },
    });

    return NextResponse.json(data);
}
