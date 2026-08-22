"use server";

import type { Client } from "@/generated/prisma/client";
import { safeAction } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { inviteClient } from "@/lib/admin/invite";
import { actionLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

type ClientEnrollment = Pick<Client, "email" | "name" | "company">;

export async function enrollClient({ email, name, company }: ClientEnrollment) {
    // Admin action lives under /admin (excluded from the middleware limiter), so throttle inline —
    // it sends an invite email per call, so cap per IP even though it's admin-gated below.
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(actionLimiter, `enroll:${ip}`);
    if (!success) return { error: `Too many requests. Please try again in ${retryAfterSeconds}s.` };

    return safeAction(async () => {
        // Server actions are public endpoints — gate independently of the admin layout UI.
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        // The invite itself lives in lib/admin/invite.ts, shared with accepting an access request.
        await inviteClient({ email, name, company });

        revalidatePath("/admin/enrollment");
    });
}
