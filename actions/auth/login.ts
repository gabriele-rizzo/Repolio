"use server";

import { isLocale, LOCALE_COOKIE } from "@/i18n/request";
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

        // Mirror the client's saved language into the locale cookie so the dashboard loads in it.
        if (data.user) {
            const client = await prisma.client.findUnique({
                where: { account_id: data.user.id },
                select: { locale: true },
            });
            if (client && isLocale(client.locale)) {
                (await cookies()).set(LOCALE_COOKIE, client.locale, {
                    path: "/",
                    maxAge: 60 * 60 * 24 * 365,
                    sameSite: "lax",
                });
            }
        }

        revalidatePath("/auth/login");
    });
}
