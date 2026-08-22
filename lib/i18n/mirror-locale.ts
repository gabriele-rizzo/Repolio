import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/locales";
import { detectLocaleFromHeaders } from "./detect";
import { prisma } from "../prisma";
import { cookies, headers } from "next/headers";

/**
 * Puts a freshly signed-in client's language into the locale cookie.
 *
 * Runs on every path that establishes a session, and there is now more than one: the password form
 * (actions/auth/login.ts) and the magic link, which lands in the /auth/confirm route handler. It lived
 * inside the login action until the magic link arrived — a second entry point that skipped it, which
 * would have signed a client in and then rendered their dashboard in German because the cookie still
 * held whatever the anonymous visit had guessed.
 *
 * Clients on automatic are re-detected here — signing in is the natural moment to notice that someone's
 * browser or country changed — and the result is written back, because their REPORTS follow `locale`
 * too and the report cron has no request to detect from.
 *
 * Best-effort by design: it is called after the session already exists, so a failure here must not turn
 * a successful login into an error. The worst case is one page load in the previous language.
 */
export async function mirrorClientLocale(accountId: string): Promise<void> {
    try {
        const client = await prisma.client.findUnique({
            where: { account_id: accountId },
            select: { id: true, locale: true, locale_auto: true },
        });

        if (!client) return;

        const stored = isLocale(client.locale) ? client.locale : DEFAULT_LOCALE;
        const locale = client.locale_auto ? detectLocaleFromHeaders(await headers()) : stored;

        if (client.locale_auto && locale !== client.locale) {
            await prisma.client.update({ where: { id: client.id }, data: { locale } });
        }

        (await cookies()).set(LOCALE_COOKIE, locale, {
            path: "/",
            maxAge: LOCALE_COOKIE_MAX_AGE,
            sameSite: "lax",
        });
    } catch (error) {
        console.error(`Failed to mirror the locale for account ${accountId}:`, error);
    }
}
