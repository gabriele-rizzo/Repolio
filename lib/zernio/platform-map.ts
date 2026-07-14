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
     * standalone only: whether the /ads connect honors a per-request redirect_url. When false, the
     * platform relies on a callback URL configured in the Zernio workspace dashboard instead.
     */
    passRedirectUrl?: boolean;
    /** the ?connected=<x> value Zernio sends to our callback after OAuth */
    connectedParam: string;
}

// Only META is wired today. Adding another ad platform is one entry here (plus its row in the two
// reverse maps below). META uses `same-token`: per Zernio's API, `facebook` is a same-token
// platform — GET /v1/connect/facebook runs OAuth (with ads scopes when the workspace has the Ads
// add-on) and shows Zernio's hosted account/Page selection, then /v1/connect/facebook/ads copies
// that token into the `metaads` grant WITHOUT any OAuth of its own. (`standalone`, where the /ads
// connect runs its own OAuth, only applies to googleads and is unused today.)
export const ZERNIO_PLATFORMS: Partial<Record<Platform, ZernioPlatform>> = {
    META: {
        slug: "meta",
        kind: "same-token",
        postingSlug: "facebook", // GET /v1/connect/facebook — OAuth + hosted Page/account selection
        adsSlug: "facebook", // GET /v1/connect/facebook/ads — copies the posting token
        adsPlatform: "metaads", // the resulting ads SocialAccount comes back as `metaads`
        connectedParam: "facebook", // Zernio redirects with connected=facebook after posting OAuth
    },
};

/** Repolio route slug -> Platform. */
export const PLATFORM_BY_SLUG: Record<string, Platform> = {
    meta: "META",
};

/** Zernio ?connected= value -> Platform. The posting connect reports the posting platform
 * (facebook/instagram); metaads kept too, in case a redirect echoes the ads platform instead. */
export const PLATFORM_BY_CONNECTED_PARAM: Record<string, Platform> = {
    metaads: "META",
    facebook: "META",
    instagram: "META",
};

/** Platforms a client can connect today — drives connect buttons in the UI. */
export const CONNECTABLE_PLATFORMS: { platform: Platform; slug: string }[] = Object.entries(ZERNIO_PLATFORMS).map(
    ([platform, config]) => ({ platform: platform as Platform, slug: config!.slug }),
);
