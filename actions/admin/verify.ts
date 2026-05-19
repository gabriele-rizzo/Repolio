"use server";

import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS, createSessionToken, verifyOTP } from "@/lib/admin/auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function verifyAdmin(code: string) {
    const verified = await verifyOTP(code);

    if (!verified) return;

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
}
