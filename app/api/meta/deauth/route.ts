import { parseSignedRequest } from "@/lib/meta/signed-request";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

// Meta calls this (POST, form-encoded) when a user removes the app. We verify
// the signed_request and remove that user's connection(s), cascading to their
// ad accounts and snapshots.
export async function POST(request: NextRequest) {
    const form = await request.formData();
    const signedRequest = form.get("signed_request");

    if (typeof signedRequest !== "string") {
        return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    const data = parseSignedRequest(signedRequest);
    if (!data?.user_id) {
        return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
    }

    await prisma.platformConnection.deleteMany({
        where: { platform: "META", external_user_id: data.user_id },
    });

    return new NextResponse(null, { status: 200 });
}
