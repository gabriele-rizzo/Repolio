import { checkEnv } from "@/lib/env";
import { parseSignedRequest } from "@/lib/meta/signed-request";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

// Meta's data-deletion callback (POST, form-encoded). We verify the
// signed_request, delete the user's data, and return the status URL +
// confirmation code Meta requires.
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

    const confirmation_code = randomUUID();
    const url = `${checkEnv("NEXT_PUBLIC_SITE_URL")}/data-deletion?code=${confirmation_code}`;

    return NextResponse.json({ url, confirmation_code });
}
