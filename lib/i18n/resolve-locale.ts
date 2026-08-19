import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/locales";

/**
 * Which language a server-side render should use, given an explicitly requested locale and the visitor's
 * locale cookie.
 *
 * EXPLICIT WINS, and that is the whole point. next-intl hands the locale from
 * `getTranslations({locale})` to the `getRequestConfig` callback, but the callback has to actually use it
 * — see the note in i18n/request.ts. When it doesn't, every explicit-locale render silently falls back to
 * the cookie, which in a cron is absent, which means DEFAULT_LOCALE. Since the default here is German,
 * German clients looked fine and everyone else quietly received German.
 *
 * Split out as a pure function so the precedence has a test: it is now load-bearing for every report
 * email, PDF and notification the app sends.
 */
export function resolveMessagesLocale(explicit: string | undefined, cookie: string | undefined): Locale {
    if (isLocale(explicit)) return explicit;
    if (isLocale(cookie)) return cookie;
    return DEFAULT_LOCALE;
}
