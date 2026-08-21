import { readFile } from "node:fs/promises";

import { ImageResponse } from "next/og";

import { BRAND_MARK } from "./brand-mark";
import { SITE_NAME, SITE_SOCIAL_DESCRIPTION, SITE_TAGLINE } from "../site";

/**
 * The image every link preview shows: Slack, Discord, WhatsApp, iMessage, LinkedIn, X.
 *
 * Drawn here rather than committed as a PNG so the card cannot drift from the copy — headline, sub and
 * host all come from lib/site.ts, the same constants the meta tags use. Served by two thin route files,
 * `app/opengraph-image.tsx` and `app/twitter-image.tsx`; X reads only `twitter:image` and does not fall
 * back to `og:image`, so both have to exist even though they render the identical card.
 *
 * 1200x630 is the size all of those platforms crop to, and the one X wants for `summary_large_image` to
 * render full width instead of as a thumbnail.
 */
export const SOCIAL_CARD = {
    alt: `${SITE_NAME}: ${SITE_TAGLINE}`,
    size: { width: 1200, height: 630 },
    contentType: "image/png",
} as const;

const INK = "#171717";
const MUTED = "#5b6660";
const MINT_WASH = "#eaf5eb";

type CardFont = { name: string; data: Buffer; weight: 400 | 600; style: "normal" };

/**
 * Geist, so the card is set in the same face as the app.
 *
 * The two files ship beside this one instead of being fetched, and that is not a preference:
 * `ImageResponse` throws when it is handed no fonts, so there is no degraded-but-drawn card to fall back
 * to, and a network hop would put every link preview at the mercy of a third party for no gain. Next
 * bundles Geist Regular for its own default, but nothing heavier — without SemiBold here the headline
 * would silently render at book weight.
 *
 * `readFile`, not the `fetch(new URL(...))` the Next docs show: Turbopack resolves `import.meta.url` to a
 * `file:` URL and Node's fetch cannot read those. The `new URL` form is still what makes the bundler
 * trace the files, so they are emitted into the build. Both routes prerender, so this runs at build time
 * and a deployed request only ever serves the finished PNG. Licence in GEIST-OFL.txt.
 */
async function geist(): Promise<CardFont[]> {
    const [regular, semibold] = await Promise.all([
        readFile(new URL("./geist-regular.woff", import.meta.url)),
        readFile(new URL("./geist-semibold.woff", import.meta.url)),
    ]);

    return [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
    ];
}

export async function renderSocialCard() {
    const fonts = await geist();

    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    padding: "64px 76px 76px",
                    backgroundColor: "#ffffff",
                    fontFamily: "Geist",
                }}
            >
                {/* Two mint blooms are the whole decoration. Plain circles rather than gradients:
                    satori's gradient support is partial, its border-radius is not. */}
                <div
                    style={{
                        display: "flex",
                        position: "absolute",
                        top: -220,
                        right: -160,
                        width: 620,
                        height: 620,
                        borderRadius: 620,
                        backgroundColor: MINT_WASH,
                    }}
                />
                <div
                    style={{
                        display: "flex",
                        position: "absolute",
                        bottom: -190,
                        left: -130,
                        width: 380,
                        height: 380,
                        borderRadius: 380,
                        backgroundColor: MINT_WASH,
                    }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- satori renders raw img only */}
                    <img src={BRAND_MARK} width={72} height={72} alt="" style={{ borderRadius: 72 }} />
                    <div style={{ display: "flex", fontSize: 38, fontWeight: 600, color: INK, letterSpacing: -0.6 }}>
                        {SITE_NAME}
                    </div>
                </div>

                {/* Mark at the top, copy at the bottom, one void between them. */}
                <div style={{ display: "flex", flex: 1 }} />

                <div
                    style={{
                        display: "flex",
                        maxWidth: 900,
                        fontSize: 66,
                        fontWeight: 600,
                        lineHeight: 1.12,
                        letterSpacing: -1,
                        color: INK,
                    }}
                >
                    {SITE_TAGLINE}
                </div>

                <div
                    style={{
                        display: "flex",
                        maxWidth: 860,
                        marginTop: 24,
                        fontSize: 27,
                        lineHeight: 1.45,
                        color: MUTED,
                    }}
                >
                    {SITE_SOCIAL_DESCRIPTION}
                </div>
            </div>
        ),
        { ...SOCIAL_CARD.size, fonts },
    );
}
