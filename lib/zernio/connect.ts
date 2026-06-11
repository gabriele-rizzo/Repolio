import { zernioFetch } from "./client";
import type { ZernioPlatform } from "./platform-map";

export interface ConnectResult {
    authUrl?: string;
    alreadyConnected?: boolean;
    accountId?: string;
}

/**
 * Step 1 of connect — get the OAuth URL to redirect the user to.
 *  - standalone (Meta): GET /v1/connect/{adsSlug}/ads?profileId — the ads connect runs its own
 *    OAuth and creates ONLY the ads account (no Facebook Page / posting account). Meta accepts a
 *    per-request redirect_url (passRedirectUrl); platforms without it use a workspace-configured callback.
 *  - same-token: GET /v1/connect/{postingSlug}?profileId&redirect_url — posting OAuth first, then
 *    the callback copies its token into an ads account. Supported but unused by any platform today.
 */
export async function startConnect(
    platform: ZernioPlatform,
    profileId: string,
    redirectUrl: string,
): Promise<ConnectResult> {
    if (platform.kind === "same-token") {
        return zernioFetch<ConnectResult>(`/v1/connect/${platform.postingSlug}`, {
            query: { profileId, redirect_url: redirectUrl },
        });
    }
    return zernioFetch<ConnectResult>(`/v1/connect/${platform.adsSlug}/ads`, {
        query: { profileId, redirect_url: platform.passRedirectUrl ? redirectUrl : undefined },
    });
}

/**
 * Same-token only: after the posting account exists, create the ads SocialAccount by copying its
 * token (no extra OAuth). Returns the ads SocialAccount id used for /v1/ads/* calls.
 */
export async function connectAds(
    platform: ZernioPlatform,
    profileId: string,
    postingAccountId: string,
): Promise<string> {
    const res = await zernioFetch<ConnectResult>(`/v1/connect/${platform.adsSlug}/ads`, {
        query: { profileId, accountId: postingAccountId },
    });
    if (!res.accountId) throw new Error(`[Zernio] connectAds returned no accountId for '${platform.slug}'`);
    return res.accountId;
}
