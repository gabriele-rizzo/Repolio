"use server";

import { isLocale, LOCALE_COOKIE } from "@/i18n/locales";
import { safeAction } from "@/lib/action";
import { accessRequestSchema, type AccessRequestInput } from "@/lib/access-request/schema";
import { detectLocaleFromHeaders } from "@/lib/i18n/detect";
import { prisma } from "@/lib/prisma";
import { authLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

/**
 * Files an access request from the public /auth/register form.
 *
 * This creates NOTHING an anonymous visitor can use: it writes one `AccessRequest` row and stops. No
 * auth user, no Client, no session, no email. An admin turns it into an account on /admin/enrollment,
 * which runs the same invite as manual enrollment.
 *
 * Rate limited on `authLimiter` (5 per 15 minutes per IP), the same bucket as login rather than the
 * looser `actionLimiter` the middleware applies to server actions generally: this is the only endpoint
 * in the app where an anonymous caller can cause a row to be written, so it is also the only one where
 * a loose limit means an anonymous caller can fill a table.
 */
export async function requestAccess(input: AccessRequestInput) {
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(authLimiter, `access-request:${ip}`);
    if (!success) return { error: `Too many requests. Please try again in ${retryAfterSeconds}s.` };

    return safeAction(async () => {
        // Re-validated server-side: a server action is a public endpoint, so the form having checked
        // means nothing here. Same schema, so the rules cannot drift.
        const { name, email, company } = accessRequestSchema.parse(input);

        // Their language, for the admin reading the queue. The cookie is set by the proxy on the first
        // visit, so it is normally already there; the header detection is the fallback for a client
        // that sends none.
        const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
        const locale = isLocale(cookie) ? cookie : detectLocaleFromHeaders(await headers());

        try {
            // One pending row per address. A visitor who submits twice — impatience, a typo in the
            // company, a lost tab — should update their request, not queue a second one for an admin to
            // reconcile. `updateMany` rather than a unique upsert because the uniqueness this relies on
            // ("at most one PENDING per email") is a partial index Prisma cannot declare, so it is not
            // enforced by the database and a second row must not throw.
            const folded = await prisma.accessRequest.updateMany({
                where: { email, status: "PENDING" },
                data: { name, company, locale },
            });

            // An address that already has an account, or was already turned down, is not told so: the
            // form answers the same way whatever it finds, because "your request is in" and "you are
            // already a client" are different answers only to someone probing for client emails.
            if (folded.count === 0) {
                const settled = await prisma.accessRequest.count({ where: { email, status: "ACCEPTED" } });

                if (settled === 0) {
                    await prisma.accessRequest.create({ data: { name, email, company, locale } });
                }
            }
        } catch (error) {
            // The table may not exist yet — the migration is applied by hand, so the code can deploy
            // first. Say so plainly instead of showing a visitor a Prisma error, and leave the reason
            // in the server log for whoever has to apply it.
            console.error("Failed to record an access request:", error);
            throw new Error("Registration is temporarily unavailable. Please try again later.");
        }

        revalidatePath("/admin/enrollment");
    });
}
