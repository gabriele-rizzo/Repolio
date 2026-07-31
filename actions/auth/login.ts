"use server";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/locales";
import { detectLocaleFromHeaders } from "@/lib/i18n/detect";
import { safeAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { authLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

export async function login(email: string, password: string) {
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(authLimiter, `login:${ip}`);
    if (!success) return { error: `Too many login attempts. Please try again in ${retryAfterSeconds}s.` };

    return safeAction(async () => {
        const supabase = await createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        // Mirror the client's language into the locale cookie so the dashboard loads in it. Clients on
        // automatic are re-detected from this request — logging in is the natural moment to notice that
        // someone's browser or country changed — and the result is written back so their REPORTS follow
        // too, since the report cron has no request to detect from.
        if (data.user) {
            const client = await prisma.client.findUnique({
                where: { account_id: data.user.id },
                select: { id: true, locale: true, locale_auto: true },
            });

            if (client) {
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
            }
        }

        revalidatePath("/auth/login");
    });
}
