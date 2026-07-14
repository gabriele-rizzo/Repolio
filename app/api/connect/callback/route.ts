import { getCurrentClient } from "@/actions/auth/authorize";
import { checkEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { finishConnection } from "@/lib/zernio/finish-connection";
import { PLATFORM_BY_CONNECTED_PARAM, ZERNIO_PLATFORMS } from "@/lib/zernio/platform-map";
import { NextResponse, type NextRequest } from "next/server";

function siteUrl(path: string): URL {
    return new URL(path, checkEnv("NEXT_PUBLIC_SITE_URL"));
}

// Zernio redirects here after OAuth (and its hosted account/Page selection) with
// ?connected={platform}&profileId=[&accountId=]. We finish the connection: for same-token (Meta)
// we find the posting account just connected and copy its token into the ads grant via
// /v1/connect/facebook/ads; for standalone (googleads, unused today) the connected account IS the
// ads account. NOTE: accountId is NOT relied upon — Zernio may omit it when reconnecting an
// already-connected account — so we can also resolve the account from the profile.
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const oauthError = searchParams.get("error");
    if (oauthError) {
        return NextResponse.redirect(siteUrl(`/dashboard?meta_error=${encodeURIComponent(oauthError)}`));
    }

    const connected = searchParams.get("connected");
    const profileId = searchParams.get("profileId");
    const accountIdParam = searchParams.get("accountId");

    const platform = connected ? PLATFORM_BY_CONNECTED_PARAM[connected] : undefined;
    const config = platform ? ZERNIO_PLATFORMS[platform] : undefined;
    if (!platform || !config || !profileId) {
        console.error(`Connect callback: missing/unknown params (connected=${connected}, profileId=${profileId})`);
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
    }

    // Resolve the owning client from the profile id, NOT the Supabase session. We arrive here from an
    // external OAuth redirect (Meta -> Zernio -> us), and the session cookie is not reliably readable
    // on that hop. Gating on it (the previous `authorize()`) bounced the request to /auth/login, which
    // then redirected to /dashboard — silently dropping the connection with no success/error param.
    // zernio_profile_id is unique and server-minted: it is stored on exactly one client and is not
    // user-guessable, so it authoritatively identifies whose connection to finish. When the session IS
    // readable we still cross-check it (defense-in-depth) and refuse if a different user is signed in.
    const client = await prisma.client.findUnique({ where: { zernio_profile_id: profileId } });
    if (!client) {
        console.error(`Connect callback: no client owns profile ${profileId}`);
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
    }

    const sessionClient = await getCurrentClient();
    if (sessionClient && sessionClient.id !== client.id) {
        console.error(
            `Connect callback: session/profile mismatch (session client ${sessionClient.id}, profile owner ${client.id})`,
        );
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
    }

    const result = await finishConnection(client.id, config, platform, profileId, accountIdParam);

    if (result.ok) {
        // The connection is recorded even with zero ad accounts (see finishConnection); still tell the
        // user when nothing came back so the empty connection card isn't a mystery.
        return NextResponse.redirect(
            siteUrl(result.hadAdAccounts ? "/dashboard?meta_connected=1" : "/dashboard?meta_error=no_ad_accounts"),
        );
    }
    if (result.reason === "plan_limit") {
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=plan_limit"));
    }
    return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
}
