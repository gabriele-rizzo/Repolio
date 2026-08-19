import { DEFAULT_LOCALE, LOCALES } from "@/i18n/locales";
import { resolveMessagesLocale } from "@/lib/i18n/resolve-locale";
import { describe, expect, it } from "vitest";

// This precedence is load-bearing for every report email, PDF attachment and in-app notification the
// app sends. When it was wrong — the request config read the cookie and ignored the explicit locale —
// all seven explicit-locale render paths silently produced DEFAULT_LOCALE, so German clients looked
// correct and everyone else received German.

describe("resolveMessagesLocale", () => {
    it("prefers an explicit locale over the cookie", () => {
        // The case that was broken: a cron rendering for an Italian client, with no cookie or a stale
        // one from whoever triggered the request.
        expect(resolveMessagesLocale("it", "de")).toBe("it");
        expect(resolveMessagesLocale("en", "de")).toBe("en");
        expect(resolveMessagesLocale("de", "it")).toBe("de");
    });

    it("honours an explicit locale when there is no cookie at all", () => {
        for (const locale of LOCALES) expect(resolveMessagesLocale(locale, undefined)).toBe(locale);
    });

    it("falls back to the cookie when nothing was named", () => {
        expect(resolveMessagesLocale(undefined, "it")).toBe("it");
        expect(resolveMessagesLocale(undefined, "en")).toBe("en");
    });

    it("falls back to the default when neither is usable", () => {
        expect(resolveMessagesLocale(undefined, undefined)).toBe(DEFAULT_LOCALE);
        expect(resolveMessagesLocale("", "")).toBe(DEFAULT_LOCALE);
    });

    it("ignores an unsupported explicit locale rather than trusting it", () => {
        // The locale reaches this from a DB column and from URLs; an unknown value must not become a
        // failed `import(../messages/<locale>.json)`.
        expect(resolveMessagesLocale("zz", "it")).toBe("it");
        expect(resolveMessagesLocale("fr", undefined)).toBe(DEFAULT_LOCALE);
        expect(resolveMessagesLocale("../../etc/passwd", undefined)).toBe(DEFAULT_LOCALE);
    });

    it("ignores an unsupported cookie value", () => {
        expect(resolveMessagesLocale(undefined, "zz")).toBe(DEFAULT_LOCALE);
        expect(resolveMessagesLocale(undefined, "en-GB")).toBe(DEFAULT_LOCALE);
    });

    it("only ever returns a supported locale", () => {
        const inputs = [undefined, "", "de", "en", "it", "zz", "EN", "en-GB", "../x"];
        for (const explicit of inputs) {
            for (const cookie of inputs) {
                expect(LOCALES).toContain(resolveMessagesLocale(explicit, cookie));
            }
        }
    });
});
