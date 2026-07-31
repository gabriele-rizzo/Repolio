import { countryFromHeaders, detectLocale, detectLocaleFromHeaders, parseAcceptLanguage } from "@/lib/i18n/detect";
import { describe, expect, it } from "vitest";

describe("parseAcceptLanguage", () => {
    it("returns nothing for a missing or empty header", () => {
        expect(parseAcceptLanguage(null)).toEqual([]);
        expect(parseAcceptLanguage(undefined)).toEqual([]);
        expect(parseAcceptLanguage("")).toEqual([]);
    });

    it("orders tags by q-value, not by position", () => {
        expect(parseAcceptLanguage("en;q=0.5,it;q=0.9,de;q=0.7")).toEqual(["it", "de", "en"]);
    });

    it("treats a missing q-value as the most preferred", () => {
        expect(parseAcceptLanguage("de-DE,en;q=0.8")).toEqual(["de-de", "en"]);
    });

    it("drops q=0, which explicitly means 'not acceptable'", () => {
        expect(parseAcceptLanguage("de;q=0,en;q=0.5")).toEqual(["en"]);
    });

    it("survives a malformed header rather than throwing", () => {
        // Runs in middleware on every request — a bad header must not 500 the site.
        expect(() => parseAcceptLanguage(";;;q=,,")).not.toThrow();
        expect(parseAcceptLanguage("it;q=banana")).toEqual([]);
    });
});

describe("detectLocale", () => {
    it("uses the browser's stated language", () => {
        expect(detectLocale({ acceptLanguage: "it-IT,it;q=0.9" })).toBe("it");
        expect(detectLocale({ acceptLanguage: "de-AT,de;q=0.9" })).toBe("de");
        expect(detectLocale({ acceptLanguage: "en-GB,en;q=0.9" })).toBe("en");
    });

    it("matches on the primary subtag, so any regional variant works", () => {
        for (const tag of ["it-CH", "it-SM", "IT-it"]) {
            expect(detectLocale({ acceptLanguage: tag })).toBe("it");
        }
    });

    it("skips languages it doesn't support and takes the next preference", () => {
        expect(detectLocale({ acceptLanguage: "fr-FR,fr;q=0.9,it;q=0.8" })).toBe("it");
    });

    /**
     * The ordering that matters: a stated browser preference beats an inferred location. Otherwise an
     * English speaker working in Milan gets an Italian dashboard while their browser asked for English.
     */
    it("prefers the browser language over the country", () => {
        expect(detectLocale({ acceptLanguage: "en-US,en;q=0.9", country: "IT" })).toBe("en");
        expect(detectLocale({ acceptLanguage: "it-IT", country: "DE" })).toBe("it");
    });

    it("falls back to the country when the browser asks for nothing supported", () => {
        expect(detectLocale({ acceptLanguage: "fr-FR,fr;q=0.9", country: "IT" })).toBe("it");
        expect(detectLocale({ acceptLanguage: null, country: "IT" })).toBe("it");
        expect(detectLocale({ acceptLanguage: null, country: "AT" })).toBe("de");
    });

    it("is case- and whitespace-insensitive about the country", () => {
        expect(detectLocale({ country: "it" })).toBe("it");
        expect(detectLocale({ country: " IT " })).toBe("it");
    });

    it("uses English for a known but unmapped country", () => {
        for (const country of ["FR", "US", "JP", "BR"]) {
            expect(detectLocale({ country })).toBe("en");
        }
    });

    it("falls back to the default when there is no signal at all", () => {
        expect(detectLocale({})).toBe("de");
        expect(detectLocale({ acceptLanguage: "", country: "" })).toBe("de");
    });
});

describe("countryFromHeaders", () => {
    it("reads Vercel's header first", () => {
        const headers = new Headers({ "x-vercel-ip-country": "IT", "cf-ipcountry": "DE" });
        expect(countryFromHeaders(headers)).toBe("IT");
    });

    it("falls back to other CDN headers", () => {
        expect(countryFromHeaders(new Headers({ "cf-ipcountry": "DE" }))).toBe("DE");
    });

    it("ignores XX, which CDNs use for 'unknown'", () => {
        expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "XX" }))).toBeNull();
    });

    it("returns null when no CDN header is present", () => {
        expect(countryFromHeaders(new Headers())).toBeNull();
    });
});

describe("detectLocaleFromHeaders", () => {
    it("combines both signals off a real Headers object", () => {
        const headers = new Headers({ "accept-language": "fr;q=0.9", "x-vercel-ip-country": "IT" });
        expect(detectLocaleFromHeaders(headers)).toBe("it");
    });

    it("returns the default for a bare request", () => {
        expect(detectLocaleFromHeaders(new Headers())).toBe("de");
    });
});
