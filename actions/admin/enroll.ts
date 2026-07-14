"use server";

import type { Client } from "@/generated/prisma/client";
import { safeAction } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { checkEnv } from "@/lib/env";
import { actionLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

type ClientEnrollment = Pick<Client, "email" | "name" | "company">;

export async function enrollClient({ email, ...data }: ClientEnrollment) {
    // Admin action lives under /admin (excluded from the middleware limiter), so throttle inline —
    // it sends an invite email per call, so cap per IP even though it's admin-gated below.
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(actionLimiter, `enroll:${ip}`);
    if (!success) return { error: `Too many requests. Please try again in ${retryAfterSeconds}s.` };

    return safeAction(async () => {
        // Server actions are public endpoints — gate independently of the admin layout UI.
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        const supabase = await createAdminClient();
        const baseUrl = checkEnv("NEXT_PUBLIC_SITE_URL");

        const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${baseUrl}/auth/confirm`,
            data,
        });

        if (error) throw error;

        revalidatePath("/admin/enrollment");
    });
}
