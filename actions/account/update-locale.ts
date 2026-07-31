"use server";

import { authorize } from "@/actions/auth/authorize";
import { AUTO_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/i18n/locales";
import { detectLocaleFromHeaders } from "@/lib/i18n/detect";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

/**
 * Persists the client's UI/report language and mirrors it into the locale cookie so the whole app
 * re-renders in it immediately. The DB row is the source of truth; the cookie is the fast read path
 * for next-intl (no per-request DB round trip).
 *
 * `"auto"` stores the language detected from THIS request and flags the client to re-detect on future
 * logins. `Client.locale` still ends up holding a concrete language either way — reports are generated
 * by a cron with no request to detect from, so they read whatever was last resolved.
 */
export async function updateLocale(choice: string) {
    const auto = choice === AUTO_LOCALE;
    if (!auto && !isLocale(choice)) throw new Error("Unsupported language.");

    const client = await authorize();
    const locale = auto ? detectLocaleFromHeaders(await headers()) : (choice as Locale);

    await prisma.client.update({
        where: { id: client.id },
        data: { locale, locale_auto: auto },
    });

    (await cookies()).set(LOCALE_COOKIE, locale, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
    });

    // Language touches every rendered string → revalidate the whole tree under the root layout.
    revalidatePath("/", "layout");

    return { locale };
}
