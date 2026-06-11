import { authorize } from "@/actions/auth/authorize";
import { checkEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { listAccounts } from "@/lib/zernio/accounts";
import { listAdAccounts } from "@/lib/zernio/ads";
import { connectAds } from "@/lib/zernio/connect";
import { PLATFORM_BY_CONNECTED_PARAM, ZERNIO_PLATFORMS } from "@/lib/zernio/platform-map";
import { NextResponse, type NextRequest } from "next/server";

function siteUrl(path: string): URL {
    return new URL(path, checkEnv("NEXT_PUBLIC_SITE_URL"));
}

// Zernio platform values that count as a Meta posting account (same-token source for ads).
const META_POSTING_PLATFORMS = ["facebook", "instagram"];

// Zernio redirects here after OAuth with ?connected={platform}&profileId=[&accountId=]. We finish
// the connection: for standalone (Meta) the connected account IS the ads account; the
// same-token branch (find a posting account, copy its token) is kept but unused by any platform.
// NOTE: accountId is NOT relied upon — Zernio omits it when reconnecting an already-connected
// account or after hosted selection — so we resolve the account from the profile instead.
export async function GET(request: NextRequest) {
    const client = await authorize();
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

    // Ownership: the profile must belong to the signed-in client.
    if (profileId !== client.zernio_profile_id) {
        console.error(
            `Connect callback: profile mismatch for client ${client.id} (got ${profileId}, expected ${client.zernio_profile_id})`,
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
            // Standalone (Meta): prefer the redirect's accountId, else find the ads account by its
            // connected platform — Meta comes back as `metaads`.
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
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
    }
}
