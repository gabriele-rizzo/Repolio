import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// Supported UI + report languages. First entry is the default/fallback.
export const LOCALES = ["de", "en", "it"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

// The active locale is carried in this cookie (mirrored from Client.locale in the DB on login and
// on change), so Server Components, Client Components and the report render all read it without a
// per-request DB round trip. Falls back to the default when absent or invalid.
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
    return value != null && (LOCALES as readonly string[]).includes(value);
}

export default getRequestConfig(async () => {
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    const locale: Locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
