import { LOCALES } from "@/i18n/locales";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The message catalogues have to agree on their keys.
 *
 * next-intl resolves a key against one locale's file only, so a key added to en.json and forgotten in
 * de.json does not fail the build, does not fail typecheck, and renders for whoever is testing in
 * English. The German visitor gets the raw key path on the page instead — and German is the DEFAULT
 * locale here, so the broken case is the one least likely to be the one anybody looks at.
 *
 * Same idea as lib/env.test.ts holding .env.example against ENV_MANIFEST: the convention is written
 * down in CLAUDE.md, so something should enforce it.
 */

type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): Map<string, string> {
    const flat = new Map<string, string>();

    for (const [key, value] of Object.entries(messages)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") flat.set(path, value);
        else for (const [nested, leaf] of flatten(value, path)) flat.set(nested, leaf);
    }

    return flat;
}

const catalogues = new Map(
    LOCALES.map((locale) => [
        locale,
        flatten(JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as Messages),
    ]),
);

// Not a placeholder-parity check as well: telling an ICU argument name from a plural option body needs
// a real parser (`{days, plural, one {Tag} other {Tage}}` reads as three "arguments" to anything
// simpler), and next-intl throws loudly on a missing argument at render anyway.
describe("message catalogues", () => {
    const reference = catalogues.get(LOCALES[0]);

    it("covers every locale", () => {
        expect([...catalogues.keys()]).toEqual([...LOCALES]);
        expect(reference?.size).toBeGreaterThan(50);
    });

    for (const locale of LOCALES.slice(1)) {
        it(`${locale} holds exactly the same keys as ${LOCALES[0]}`, () => {
            const keys = new Set(catalogues.get(locale)?.keys());
            const expected = new Set(reference?.keys());

            expect([...expected].filter((k) => !keys.has(k)).sort()).toEqual([]);
            expect([...keys].filter((k) => !expected.has(k)).sort()).toEqual([]);
        });
    }

    for (const locale of LOCALES) {
        it(`${locale} leaves no key untranslated`, () => {
            const blank = [...(catalogues.get(locale) ?? [])].filter(([, v]) => v.trim().length === 0);
            expect(blank.map(([k]) => k)).toEqual([]);
        });
    }
});
