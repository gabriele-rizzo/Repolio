"use server";

import { safeAction } from "@/lib/action";
import { mirrorClientLocale } from "@/lib/i18n/mirror-locale";
import { authLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

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

        // Mirror the client's language into the locale cookie so the dashboard loads in it. Shared with
        // the magic-link path, which establishes its session in the /auth/confirm route handler — see
        // lib/i18n/mirror-locale.ts for what it does about clients on automatic.
        if (data.user) await mirrorClientLocale(data.user.id);

        revalidatePath("/auth/login");
    });
}
