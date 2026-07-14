import { authorize } from "@/actions/auth/authorize";
import type { Platform } from "@/generated/prisma/browser";
import { checkEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { disconnectAccount, listAccounts } from "@/lib/zernio/accounts";
import { ZernioError } from "@/lib/zernio/client";
import { startConnect } from "@/lib/zernio/connect";
import { finishConnection } from "@/lib/zernio/finish-connection";
import { PLATFORM_BY_CONNECTED_PARAM, PLATFORM_BY_SLUG, ZERNIO_PLATFORMS } from "@/lib/zernio/platform-map";
import { createProfile, deleteProfile } from "@/lib/zernio/profiles";
import { NextResponse, type NextRequest } from "next/server";

function siteUrl(path: string): URL {
    return new URL(path, checkEnv("NEXT_PUBLIC_SITE_URL"));
}

// Starts a Zernio connect flow for the signed-in client: ensures their Profile exists, then
// redirects to the platform's OAuth URL. Zernio redirects back to /api/connect/callback.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
    const client = await authorize();

    const { platform: slug } = await params;
    const platform = PLATFORM_BY_SLUG[slug];
    const config = platform ? ZERNIO_PLATFORMS[platform] : undefined;
    if (!config) return NextResponse.redirect(siteUrl("/dashboard?meta_error=unsupported_platform"));

    let profileId: string;
    try {
        profileId = await ensureProfile(client.id, client.name);
    } catch (error) {
        if (error instanceof ZernioError && (error.status === 402 || error.status === 403)) {
            return NextResponse.redirect(siteUrl("/dashboard?meta_error=plan_limit"));
        }
        console.error(`Failed to ensure Zernio profile for client ${client.id}:`, error);
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
    }

    try {
        const redirectUrl = siteUrl("/api/connect/callback").toString();
        let result = await startConnect(config, profileId, redirectUrl);

        // A fresh connect returns an OAuth authUrl (for same-token Meta that URL is where Zernio
        // hosts the account/Page selector). When it doesn't, Zernio is short-circuiting on a grant
        // already on the profile — either a real connection being re-clicked, or one left by an
        // earlier attempt that never got recorded here (abandoned OAuth, or a later step failed
        // before the PlatformConnection row was written).
        //
        // Reconcile-before-clear: try to record that existing grant directly. If it resolves, we're
        // done without destroying anything or bouncing the user through OAuth again — this is what
        // recovers a live Zernio grant that Repolio never wrote a row for. Only when the grant is
        // partial/stale (no usable posting account) do we free it and retry once to force a fresh
        // selector; plan/other errors are surfaced without destroying the grant.
        if (!result.authUrl) {
            const finish = await finishConnection(client.id, config, platform, profileId, result.accountId ?? null);

            if (finish.ok) {
                return NextResponse.redirect(
                    siteUrl(finish.hadAdAccounts ? "/dashboard?meta_connected=1" : "/dashboard?meta_error=no_ad_accounts"),
                );
            }
            if (finish.reason === "plan_limit") {
                return NextResponse.redirect(siteUrl("/dashboard?meta_error=plan_limit"));
            }
            if (finish.reason === "error") {
                return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
            }

            // reason === "no_posting": the grant can't be turned into a connection. Free it and force
            // a fresh OAuth so the hosted selector runs again.
            await clearOrphanGrants(profileId, platform);
            result = await startConnect(config, profileId, redirectUrl);

            // Still short-circuiting: cleanup couldn't free the grant. Reconcile once more as a last
            // resort so we don't strand the user on the dashboard with nothing to select.
            if (!result.authUrl) {
                const retry = await finishConnection(client.id, config, platform, profileId, result.accountId ?? null);
                return NextResponse.redirect(
                    siteUrl(
                        retry.ok
                            ? retry.hadAdAccounts
                                ? "/dashboard?meta_connected=1"
                                : "/dashboard?meta_error=no_ad_accounts"
                            : "/dashboard?meta_error=connection_failed",
                    ),
                );
            }
        }

        return NextResponse.redirect(result.authUrl);
    } catch (error) {
        console.error(`Zernio connect failed for client ${client.id} (${slug}):`, error);
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
    }
}

/**
 * Frees grants left on the profile for `platform` that we never recorded a connection for. Such
 * orphans make Zernio's next connect short-circuit (no OAuth, no account/Page selection), so
 * clearing them lets the hosted selector run again. The set of Zernio account `platform` values
 * that belong to a Repolio platform is derived from the connected-param reverse map
 * (META -> facebook, instagram, metaads). Best-effort: a failed disconnect just means the retry may
 * still short-circuit, which is no worse than before.
 */
async function clearOrphanGrants(profileId: string, platform: Platform): Promise<void> {
    const platformValues = new Set(
        Object.entries(PLATFORM_BY_CONNECTED_PARAM)
            .filter(([, p]) => p === platform)
            .map(([value]) => value),
    );

    const accounts = await listAccounts(profileId);
    for (const account of accounts) {
        if (!platformValues.has(account.platform)) continue;
        try {
            await disconnectAccount(account._id);
        } catch (error) {
            console.error(`Failed to clear orphan Zernio grant ${account._id} (${account.platform}):`, error);
        }
    }
}

/**
 * Returns the client's Zernio Profile id, creating it on first connect. The create-then-claim is
 * made idempotent against concurrent connects: if another request claimed the slot first, the
 * just-created (still-empty) profile is deleted and the winner's id is used.
 */
async function ensureProfile(clientId: number, clientName: string): Promise<string> {
    const existing = await prisma.client.findUnique({
        where: { id: clientId },
        select: { zernio_profile_id: true },
    });
    if (existing?.zernio_profile_id) return existing.zernio_profile_id;

    const profile = await createProfile(clientName);

    const { count } = await prisma.client.updateMany({
        where: { id: clientId, zernio_profile_id: null },
        data: { zernio_profile_id: profile._id },
    });

    if (count === 0) {
        try {
            await deleteProfile(profile._id);
        } catch (error) {
            console.error(`Failed to clean up orphan Zernio profile ${profile._id}:`, error);
        }
        const winner = await prisma.client.findUnique({
            where: { id: clientId },
            select: { zernio_profile_id: true },
        });
        if (!winner?.zernio_profile_id) throw new Error("Profile claim race left no winner");
        return winner.zernio_profile_id;
    }

    return profile._id;
}
