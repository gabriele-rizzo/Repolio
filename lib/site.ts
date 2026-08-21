/**
 * How Repolio describes itself to everything outside the app: search results, the link preview Slack,
 * Discord, WhatsApp and iMessage unfurl, and the X card.
 *
 * These strings live here rather than inline in `app/layout.tsx` because three places need the same
 * ones — the metadata block, the generated social image (`lib/og/social-card.tsx`) and `site.test.ts`.
 * The lengths are the reason for the test: a title under ~50 characters leaves the search result line
 * half empty, and a description under ~120 gets padded by the crawler with whatever text it scrapes off
 * the page instead. The old metadata was a 7-character title and a 42-character description, which is
 * how both happened. The test pins the ranges so shortening one fails the build rather than quietly
 * costing the snippet.
 */

export const SITE_NAME = "Repolio";

/** The value proposition on its own, without the brand prefix. Headline of the social image. */
export const SITE_TAGLINE = "AI ad performance reports for marketing agencies";

/** `<title>` and `og:title` for the site root. Aimed at the 50-60 characters a SERP line holds. */
export const SITE_TITLE = `${SITE_NAME}: ${SITE_TAGLINE}`;

/**
 * Suffix for every other page's title. Pages set their own bare title ("Reports") and Next composes it,
 * so the brand is appended in one place instead of being retyped in fifteen `metadata` blocks.
 */
export const SITE_TITLE_TEMPLATE = `%s | ${SITE_NAME}`;

/** `<meta name="description">`. Aimed at the 120-160 characters a search snippet shows. */
export const SITE_DESCRIPTION =
    "Repolio turns your clients' ad data into a finished performance report on the cadence you choose. " +
    "Connect the accounts once, review the draft, then send it.";

/**
 * `og:description`. Shorter than the search description on purpose: link previews truncate around 125
 * characters, and a cut-off sentence in a Slack unfurl reads worse than a complete shorter one.
 */
export const SITE_SOCIAL_DESCRIPTION =
    "Connect a client's ad accounts once. Repolio pulls the data daily and writes the report on your " +
    "cadence, ready for review.";

/**
 * The origin absolute metadata URLs are built from — `metadataBase`, so `og:image` resolves to a full
 * URL (crawlers reject relative ones).
 *
 * Reads the environment directly instead of `checkEnv`, which throws: this is called at module scope by
 * the root layout's `metadata`, so a throw here is a failed build rather than a missing meta tag. The
 * Vercel fallback keeps preview deployments and a bare `next build` pointing somewhere real.
 */
export function siteOrigin(): URL {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (configured) return new URL(configured);

    const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (production) return new URL(`https://${production}`);

    return new URL("http://localhost:3000");
}
