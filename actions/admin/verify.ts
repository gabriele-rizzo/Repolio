"use server";

import { safeAction } from "@/lib/action";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS, createSessionToken, verifyOTP } from "@/lib/admin/auth";
import { authLimiter, checkLimit, clientIp, otpGlobalLimiter } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

export async function verifyAdmin(code: string) {
    // Our own 6-digit TOTP check has a small keyspace and no upstream limit. Throttle per IP AND
    // globally: the per-IP cap stops single-source brute force, the global cap stops IP rotation.
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const perIp = await checkLimit(authLimiter, `admin-otp:${ip}`);
    if (!perIp.success) return { error: `Too many attempts. Please try again in ${perIp.retryAfterSeconds}s.` };

    const global = await checkLimit(otpGlobalLimiter, "admin-otp:global");
    if (!global.success) return { error: `Too many attempts right now. Please try again in ${global.retryAfterSeconds}s.` };

    return safeAction(async () => {
        const verified = await verifyOTP(code);
        if (!verified) throw new Error("Invalid OTP verification code");

        const store = await cookies();
        const token = createSessionToken();

        store.set(ADMIN_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: ADMIN_SESSION_TTL_SECONDS,
        });

        revalidatePath("/admin", "layout");
    });
}
