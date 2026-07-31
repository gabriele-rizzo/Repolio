// Locale constants, deliberately free of any server import.
//
// Split out of i18n/request.ts because that module calls `next/headers`: the moment a Client Component
// imports a constant from it, next/headers lands in the browser bundle and the build fails. Everything
// here is plain data, so server code, edge middleware and client components can all share it.

/** Supported UI + report languages. First entry is the default/fallback. */
export const LOCALES = ["de", "en", "it"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

/**
 * The active locale is carried in this cookie (mirrored from Client.locale on login and on change), so
 * Server Components, Client Components and the report render all read it without a per-request DB
 * round trip. Falls back to the default when absent or invalid.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** How long the locale cookie lives. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * The language switcher's "follow my browser" option, alongside the concrete LOCALES. Not defined in
 * the server action that consumes it — a "use server" module may only export async functions.
 */
export const AUTO_LOCALE = "auto";
export type LocaleChoice = Locale | typeof AUTO_LOCALE;

export function isLocale(value: string | undefined | null): value is Locale {
    return value != null && (LOCALES as readonly string[]).includes(value);
}
