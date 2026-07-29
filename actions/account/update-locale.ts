"use server";

import { authorize } from "@/actions/auth/authorize";
import { isLocale, LOCALE_COOKIE } from "@/i18n/request";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * Persists the client's UI/report language and mirrors it into the locale cookie so the whole app
 * re-renders in it immediately. The DB row is the source of truth; the cookie is the fast read path
 * for next-intl (no per-request DB round trip).
 */
export async function updateLocale(locale: string) {
    if (!isLocale(locale)) throw new Error("Unsupported language.");

    const client = await authorize();

    await prisma.client.update({
        where: { id: client.id },
        data: { locale },
    });

    (await cookies()).set(LOCALE_COOKIE, locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: "lax",
    });

    // Language touches every rendered string → revalidate the whole tree under the root layout.
    revalidatePath("/", "layout");
}
