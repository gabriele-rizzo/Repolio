"use server";

import { safeAction } from "@/lib/action";
import {
    ADMIN_COOKIE_NAME,
    ADMIN_SESSION_TTL_SECONDS,
    createSessionToken,
    verifyAdminPassword,
} from "@/lib/admin/auth";
import { authLimiter, checkLimit, clientIp, otpGlobalLimiter } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

export async function verifyAdmin(password: string) {
    // Throttled per IP AND globally. The per-IP cap stops single-source brute force; the global cap
    // stops brute force spread across rotating IPs. Both matter more now than under the old TOTP code:
    // a static password stays guessable until someone rotates it, whereas a TOTP guess was only ever
    // valid for one window.
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const perIp = await checkLimit(authLimiter, `admin-login:${ip}`);
    if (!perIp.success) return { error: `Too many attempts. Please try again in ${perIp.retryAfterSeconds}s.` };

    const global = await checkLimit(otpGlobalLimiter, "admin-login:global");
    if (!global.success) return { error: `Too many attempts right now. Please try again in ${global.retryAfterSeconds}s.` };

    return safeAction(async () => {
        // A configuration failure (missing or too-short ADMIN_PASSWORD) throws with its own message and
        // surfaces as-is, so the operator sees the real cause rather than "wrong password".
        const verified = await verifyAdminPassword(password);
        if (!verified) throw new Error("Incorrect password.");

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
