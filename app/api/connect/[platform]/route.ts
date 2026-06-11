import { authorize } from "@/actions/auth/authorize";
import { checkEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ZernioError } from "@/lib/zernio/client";
import { startConnect } from "@/lib/zernio/connect";
import { PLATFORM_BY_SLUG, ZERNIO_PLATFORMS } from "@/lib/zernio/platform-map";
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
        const result = await startConnect(config, profileId, redirectUrl);

        // Standalone platforms can report "already connected" with no OAuth — reconcile via the
        // callback so the same upsert path runs.
        if (!result.authUrl) {
            const qs = new URLSearchParams({ connected: config.connectedParam, profileId });
            if (result.accountId) qs.set("accountId", result.accountId);
            return NextResponse.redirect(siteUrl(`/api/connect/callback?${qs}`));
        }

        return NextResponse.redirect(result.authUrl);
    } catch (error) {
        console.error(`Zernio connect failed for client ${client.id} (${slug}):`, error);
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
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
