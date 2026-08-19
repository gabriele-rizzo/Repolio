import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { resolveMessagesLocale } from "../lib/i18n/resolve-locale";
import { LOCALE_COOKIE, type Locale } from "./locales";

// next-intl's per-request config. The constants live in ./locales because this module imports
// next/headers, which cannot be pulled into a client bundle.
//
// The `locale` parameter is NOT optional to handle. next-intl passes the locale from an explicit
// `getTranslations({locale})` call in here, and it is this callback's job to honour it — see
// GetRequestConfigParams in next-intl's types. Reading only the cookie meant every explicit-locale
// render (the batch report email, its PDF attachment, the single-report HTML, the in-app notifications,
// the template preview — seven call sites) ignored the language it had been given and used the cookie
// instead. In a cron there is no cookie, so they all rendered in DEFAULT_LOCALE: German clients looked
// correct and every other client silently received German.
export default getRequestConfig(async ({ locale: explicit }) => {
    // Only touch cookies() when no locale was named. It is a dynamic request API, and the callers that
    // pass a locale explicitly are exactly the ones with no meaningful request to read from.
    const cookie = explicit === undefined ? (await cookies()).get(LOCALE_COOKIE)?.value : undefined;
    const locale: Locale = resolveMessagesLocale(explicit, cookie);

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
