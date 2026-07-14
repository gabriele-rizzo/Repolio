"use server";

import { safeAction } from "@/lib/action";
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
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        revalidatePath("/auth/login");
    });
}
