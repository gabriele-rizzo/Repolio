import { authorize } from "@/actions/auth/authorize";
import { checkEnv } from "@/lib/env";
import { buildAuthorizeUrl } from "@/lib/meta/oauth";
import { META_STATE_COOKIE, META_STATE_TTL_SECONDS, generateState } from "@/lib/meta/state";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    const client = await authorize();
    if (!client) {
        return NextResponse.redirect(new URL("/auth/login", checkEnv("NEXT_PUBLIC_SITE_URL")));
    }

    const state = generateState();

    const store = await cookies();
    store.set(META_STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: META_STATE_TTL_SECONDS,
    });

    return NextResponse.redirect(buildAuthorizeUrl(state));
}
