import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/i18n/locales";

/**
 * Picks a language for a visitor from what the request tells us about them.
 *
 * Two signals, in this order:
 *
 *  1. `Accept-Language` — the language the person actually chose in their browser or OS. This is a
 *     stated preference, so it beats anything inferred.
 *  2. Country, from the CDN's geo header. A guess: it's right for a resident, wrong for a German
 *     speaker living in Milan, and wrong for anyone on a VPN. Only consulted when the browser tells
 *     us nothing we support.
 *
 * Deliberately ordered that way. Location alone would hand an English-speaking visitor in Rome an
 * Italian dashboard while their browser has been asking for English the whole time.
 */

/** Country → language, for countries where the mapping is unambiguous. */
const COUNTRY_LOCALE: Record<string, Locale> = {
    IT: "it",
    SM: "it", // San Marino
    VA: "it", // Vatican City
    DE: "de",
    AT: "de",
    CH: "de", // Multilingual, but German is the plurality language.
    LI: "de",
};

/** Where a country is known but not mapped, English is the safer international default. */
const UNMAPPED_COUNTRY_LOCALE: Locale = "en";

/**
 * Parses an `Accept-Language` header into its language tags, most-preferred first.
 *
 * Handles the q-value form (`de-DE,de;q=0.9,en;q=0.8`). Malformed or missing q-values sort as 1.0,
 * matching the spec's default, and a malformed header simply yields fewer candidates rather than
 * throwing — this runs in middleware on every request.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
    if (!header) return [];

    return header
        .split(",")
        .map((part) => {
            const [tag, ...params] = part.trim().split(";");
            const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
            const quality = q ? Number.parseFloat(q.slice(2)) : 1;

            return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
        })
        .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
        .sort((a, b) => b.quality - a.quality)
        .map((entry) => entry.tag);
}

export interface DetectLocaleInput {
    /** The request's `Accept-Language` header. */
    acceptLanguage?: string | null;
    /** ISO 3166-1 alpha-2 country from the CDN geo header, if any. */
    country?: string | null;
}

export function detectLocale({ acceptLanguage, country }: DetectLocaleInput): Locale {
    // "de-AT" and "de" both mean German to us — match on the primary subtag.
    for (const tag of parseAcceptLanguage(acceptLanguage)) {
        const primary = tag.split("-")[0];
        if (isLocale(primary)) return primary;
    }

    if (country) {
        const upper = country.trim().toUpperCase();
        if (upper.length > 0) return COUNTRY_LOCALE[upper] ?? UNMAPPED_COUNTRY_LOCALE;
    }

    return DEFAULT_LOCALE;
}

/** Header names carrying the visitor's country, in the order we trust them. Vercel's comes first. */
const COUNTRY_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "x-geo-country"];

/** Reads the country a CDN attached to the request, if any is present. */
export function countryFromHeaders(headers: Headers): string | null {
    for (const name of COUNTRY_HEADERS) {
        const value = headers.get(name);
        if (value && value.trim().length > 0 && value !== "XX") return value;
    }

    return null;
}

/** Convenience wrapper: detect straight from a request's headers. */
export function detectLocaleFromHeaders(headers: Headers): Locale {
    return detectLocale({
        acceptLanguage: headers.get("accept-language"),
        country: countryFromHeaders(headers),
    });
}

export { LOCALES };
