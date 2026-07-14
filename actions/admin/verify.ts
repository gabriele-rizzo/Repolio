"use server";

import { safeAction } from "@/lib/action";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS, createSessionToken, verifyOTP } from "@/lib/admin/auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function verifyAdmin(code: string) {
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
