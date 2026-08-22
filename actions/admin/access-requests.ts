"use server";

import { safeAction } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { inviteClient } from "@/lib/admin/invite";
import { prisma } from "@/lib/prisma";
import { actionLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/**
 * Reviewing the queue that /auth/register writes into.
 *
 * Accepting is the only thing here that touches the outside world, and it deliberately does it in this
 * order: invite first, mark the row second. If the invite fails, the request stays PENDING and can be
 * retried — the opposite order would leave a request marked ACCEPTED with no account behind it and
 * nothing to say so.
 */

/** Both actions are admin-gated and throttled the same way as enrollment. */
async function guard(bucket: string) {
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(actionLimiter, `${bucket}:${ip}`);
    if (!success) return `Too many requests. Please try again in ${retryAfterSeconds}s.`;

    // Server actions are public endpoints — gate independently of the admin layout UI.
    if (!(await isAdminAuthenticated())) return "Unauthorized.";

    return null;
}

export async function acceptAccessRequest(id: number) {
    const denied = await guard("access-accept");
    if (denied) return { error: denied };

    return safeAction(async () => {
        // `status: "PENDING"` in the lookup is what makes a double-click safe: the second call finds
        // nothing and reports it, rather than sending a second invite to someone already invited.
        const request = await prisma.accessRequest.findFirst({
            where: { id, status: "PENDING" },
            select: { id: true, name: true, email: true, company: true },
        });

        if (!request) throw new Error("That request is no longer pending.");

        await inviteClient({ email: request.email, name: request.name, company: request.company });

        await prisma.accessRequest.update({
            where: { id: request.id },
            data: { status: "ACCEPTED", reviewed_at: new Date() },
        });

        revalidatePath("/admin/enrollment");
    });
}

export async function rejectAccessRequest(id: number) {
    const denied = await guard("access-reject");
    if (denied) return { error: denied };

    return safeAction(async () => {
        // Kept rather than deleted: a rejected request is why an address that asked never heard back,
        // and the register form checks only for PENDING and ACCEPTED rows, so the same person can ask
        // again later without this row standing in their way.
        const { count } = await prisma.accessRequest.updateMany({
            where: { id, status: "PENDING" },
            data: { status: "REJECTED", reviewed_at: new Date() },
        });

        if (count === 0) throw new Error("That request is no longer pending.");

        revalidatePath("/admin/enrollment");
    });
}
