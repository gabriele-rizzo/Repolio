import { authorize } from "@/actions/auth/authorize";
import { checkEnv } from "@/lib/env";
import { exchangeCodeForToken, exchangeForLongLivedToken } from "@/lib/meta/oauth";
import { META_STATE_COOKIE } from "@/lib/meta/state";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

function siteUrl(path: string) {
    return new URL(path, checkEnv("NEXT_PUBLIC_SITE_URL"));
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const metaError = searchParams.get("error");
    if (metaError) {
        const description = searchParams.get("error_description") ?? metaError;
        return NextResponse.redirect(siteUrl(`/dashboard?meta_error=${encodeURIComponent(description)}`));
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    const store = await cookies();
    const expectedState = store.get(META_STATE_COOKIE)?.value;
    store.delete(META_STATE_COOKIE);

    if (!code || !state || !expectedState || state !== expectedState) {
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=invalid_state"));
    }

    const client = await authorize();
    if (!client) return NextResponse.redirect(siteUrl("/auth/login"));

    const short = await exchangeCodeForToken(code);
    const long = await exchangeForLongLivedToken(short.access_token);

    console.log("[meta] connected client", client.id);
    console.log("[meta] long-lived token expires_in (s):", long.expires_in);
    console.log("[meta] long-lived access_token:", long.access_token);

    return NextResponse.redirect(siteUrl("/dashboard?meta_connected=1"));
}
