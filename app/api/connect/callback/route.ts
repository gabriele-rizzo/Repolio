import { getCurrentClient } from "@/actions/auth/authorize";
import { checkEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { listAccounts } from "@/lib/zernio/accounts";
import { listAdAccounts } from "@/lib/zernio/ads";
import { ZernioError } from "@/lib/zernio/client";
import { connectAds } from "@/lib/zernio/connect";
import { PLATFORM_BY_CONNECTED_PARAM, ZERNIO_PLATFORMS } from "@/lib/zernio/platform-map";
import { NextResponse, type NextRequest } from "next/server";

function siteUrl(path: string): URL {
    return new URL(path, checkEnv("NEXT_PUBLIC_SITE_URL"));
}

// Zernio platform values that count as a Meta posting account (same-token source for ads).
const META_POSTING_PLATFORMS = ["facebook", "instagram"];

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

    try {
        let adsAccountId: string;
        let postingAccountId: string | null = null;

        if (config.kind === "same-token") {
            // Meta: find the posting account just connected, then copy its token into an ads grant.
            const accounts = await listAccounts(profileId);
            const posting =
                (accountIdParam && accounts.find((a) => a._id === accountIdParam)) ||
                accounts.find((a) => a.platform === connected) ||
                accounts.find((a) => META_POSTING_PLATFORMS.includes(a.platform));

            if (!posting) {
                console.error(
                    `Connect callback: no posting account in profile ${profileId} (${accounts.length} accounts: ${accounts
                        .map((a) => a.platform)
                        .join(", ")})`,
                );
                return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
            }

            postingAccountId = posting._id;
            adsAccountId = await connectAds(config, profileId, posting._id);
        } else {
            // Standalone (googleads, unused today): prefer the redirect's accountId, else find the
            // ads account by its connected platform.
            if (accountIdParam) {
                adsAccountId = accountIdParam;
            } else {
                const adsPlatform = config.adsPlatform ?? config.adsSlug;
                const accounts = await listAccounts(profileId);
                const ads = accounts.find((a) => a.platform === adsPlatform);
                if (!ads) {
                    console.error(`Connect callback: no ${adsPlatform} account in profile ${profileId}`);
                    return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
                }
                adsAccountId = ads._id;
            }
        }

        const adAccounts = await listAdAccounts(adsAccountId);
        if (adAccounts.length === 0) {
            console.error(`Connect callback: ads account ${adsAccountId} exposed no ad accounts`);
            return NextResponse.redirect(siteUrl("/dashboard?meta_error=no_ad_accounts"));
        }

        const connection = await prisma.platformConnection.upsert({
            where: { client_id_platform: { client_id: client.id, platform } },
            create: {
                client_id: client.id,
                platform,
                zernio_account_id: adsAccountId,
                zernio_posting_account_id: postingAccountId,
                status: "CONNECTED",
            },
            update: {
                zernio_account_id: adsAccountId,
                zernio_posting_account_id: postingAccountId,
                status: "CONNECTED",
            },
        });

        await prisma.$transaction(
            adAccounts.map((acc) =>
                prisma.adAccount.upsert({
                    where: { connection_id_external_id: { connection_id: connection.id, external_id: acc.id } },
                    create: {
                        connection_id: connection.id,
                        external_id: acc.id,
                        name: acc.name ?? null,
                        currency: acc.currency ?? null,
                        timezone: acc.timezoneName ?? null,
                    },
                    update: {
                        name: acc.name ?? null,
                        currency: acc.currency ?? null,
                        timezone: acc.timezoneName ?? null,
                    },
                }),
            ),
        );

        return NextResponse.redirect(siteUrl("/dashboard?meta_connected=1"));
    } catch (error) {
        console.error(`Zernio connect callback failed for client ${client.id}:`, error);
        // 402/403 from connectAds means the workspace plan lacks ads access (Ads add-on) — surface
        // the plan message instead of a generic failure.
        if (error instanceof ZernioError && (error.status === 402 || error.status === 403)) {
            return NextResponse.redirect(siteUrl("/dashboard?meta_error=plan_limit"));
        }
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
    }
}
