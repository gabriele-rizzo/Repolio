import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locales";

// next-intl's per-request config. The constants live in ./locales because this module imports
// next/headers, which cannot be pulled into a client bundle.

export default getRequestConfig(async () => {
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    const locale: Locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;

    return {
        locale,
        messages: (await import(`../messages/${locale}.json`)).default,
    };
});
