import { authorize } from "@/actions/auth/authorize";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const client = await authorize();
    if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
