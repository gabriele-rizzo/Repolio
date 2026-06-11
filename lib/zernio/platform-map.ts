import type { Platform } from "@/generated/prisma/browser";

export type ConnectKind = "same-token" | "standalone" | "separate-token";

export interface ZernioPlatform {
    /** Repolio-facing route segment: /api/connect/<slug> */
    slug: string;
    kind: ConnectKind;
    /** same-token only: the posting platform to OAuth first; its token is copied to the ads account. */
    postingSlug?: string;
    /** the {platform} path segment for GET /v1/connect/{platform}/ads */
    adsSlug: string;
    /**
     * The connected SocialAccount's `platform` value to match in the callback. Differs from adsSlug
     * when the connect path segment and the resulting account platform aren't the same string —
     * Meta connects at `facebook/ads` but the account comes back as `metaads`. Defaults to adsSlug.
     */
    adsPlatform?: string;
    /**
     * standalone only: whether the /ads connect honors a per-request redirect_url (Meta does, so we
     * never depend on dashboard config). When false, the platform relies on a callback URL configured
     * in the Zernio workspace dashboard instead.
     */
    passRedirectUrl?: boolean;
    /** the ?connected=<x> value Zernio sends to our callback after OAuth */
    connectedParam: string;
}

// Only META is wired today. Adding another ad platform is one entry here (plus its row in the two
// reverse maps below). META uses `standalone`: the /ads connect runs its own OAuth and creates ONLY
// the ads account — no Facebook Page / posting account. (`same-token`, which connects a posting
// account and copies its token, is still supported below but unused by any platform.)
export const ZERNIO_PLATFORMS: Partial<Record<Platform, ZernioPlatform>> = {
    META: {
        slug: "meta",
        kind: "standalone",
        adsSlug: "facebook", // GET /v1/connect/facebook/ads
        adsPlatform: "metaads", // the connected ads SocialAccount comes back as `metaads`
        passRedirectUrl: true, // facebook/ads accepts our per-request redirect_url
        connectedParam: "metaads",
    },
};

/** Repolio route slug -> Platform. */
export const PLATFORM_BY_SLUG: Record<string, Platform> = {
    meta: "META",
};

/** Zernio ?connected= value -> Platform. Meta's ads connect may report metaads (facebook/instagram
 * kept too, in case the hosted redirect still echoes the underlying posting platform). */
export const PLATFORM_BY_CONNECTED_PARAM: Record<string, Platform> = {
    metaads: "META",
    facebook: "META",
    instagram: "META",
};

/** Platforms a client can connect today — drives connect buttons in the UI. */
export const CONNECTABLE_PLATFORMS: { platform: Platform; slug: string }[] = Object.entries(ZERNIO_PLATFORMS).map(
    ([platform, config]) => ({ platform: platform as Platform, slug: config!.slug }),
);
