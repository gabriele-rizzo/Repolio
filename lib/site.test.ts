import {
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_SOCIAL_DESCRIPTION,
    SITE_TAGLINE,
    SITE_TITLE,
    SITE_TITLE_TEMPLATE,
    siteOrigin,
} from "@/lib/site";
import { afterEach, describe, expect, it } from "vitest";

/**
 * These are length tests because length is the whole failure mode. The metadata this replaced was a
 * 7-character title and a 42-character description: valid, rendered, and wasting most of both the search
 * snippet and the link preview. Nothing about a short string looks broken in a browser, so only a test
 * catches it going short again.
 */
describe("site copy", () => {
    it("gives the search result a full title line", () => {
        expect(SITE_TITLE.length).toBeGreaterThanOrEqual(50);
        expect(SITE_TITLE.length).toBeLessThanOrEqual(60);
    });

    it("gives the search result a full snippet", () => {
        expect(SITE_DESCRIPTION.length).toBeGreaterThanOrEqual(120);
        expect(SITE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    });

    it("keeps the link preview description inside what a card shows", () => {
        // Slack, Discord and X all truncate around 125 characters, and a sentence cut mid-word reads
        // worse than a complete shorter one — so this one is deliberately not the search description.
        expect(SITE_SOCIAL_DESCRIPTION.length).toBeGreaterThanOrEqual(80);
        expect(SITE_SOCIAL_DESCRIPTION.length).toBeLessThanOrEqual(125);
    });

    it("leads the title with the brand and carries the tagline", () => {
        expect(SITE_TITLE.startsWith(SITE_NAME)).toBe(true);
        expect(SITE_TITLE).toContain(SITE_TAGLINE);
    });

    it("appends the brand to every other page's title exactly once", () => {
        // Pages set a bare title ("Reports") and Next composes this. Before the template they each
        // spelled the suffix out, which is how two of them ended up with a different separator.
        expect(SITE_TITLE_TEMPLATE).toBe(`%s | ${SITE_NAME}`);
        expect(SITE_TITLE_TEMPLATE.match(/%s/g)).toHaveLength(1);
    });

    it("uses no dash characters that a crawler can mangle", () => {
        // Em and en dashes survive fine in HTML but not in every feed, card renderer or plain-text
        // fallback that reads these tags. Straight punctuation only in the copy that leaves the app.
        for (const copy of [SITE_TITLE, SITE_TAGLINE, SITE_DESCRIPTION, SITE_SOCIAL_DESCRIPTION]) {
            expect(copy).not.toMatch(/[–—]/);
        }
    });
});

describe("siteOrigin", () => {
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;

    afterEach(() => {
        process.env.NEXT_PUBLIC_SITE_URL = site;
        process.env.VERCEL_PROJECT_PRODUCTION_URL = vercel;
    });

    it("prefers the configured origin", () => {
        process.env.NEXT_PUBLIC_SITE_URL = "https://repolio.example.com";
        expect(siteOrigin().origin).toBe("https://repolio.example.com");
    });

    it("falls back to the Vercel production host", () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        process.env.VERCEL_PROJECT_PRODUCTION_URL = "repolio-one.vercel.app";
        expect(siteOrigin().origin).toBe("https://repolio-one.vercel.app");
    });

    it("falls back to localhost rather than throwing", () => {
        // Called at module scope by the root layout's `metadata`, so a throw is a failed build.
        delete process.env.NEXT_PUBLIC_SITE_URL;
        delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
        expect(siteOrigin().origin).toBe("http://localhost:3000");
    });
});
