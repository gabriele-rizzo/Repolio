"use server";

import { safeAction, type ActionResult } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { MAX_ACCOUNT_CONTEXT } from "@/lib/report/account-context";
import { revalidatePath } from "next/cache";

/**
 * Admin-side standing context for one ad account — the background every report on that account is
 * generated with.
 *
 * The client can edit the same field from their report page, so last save wins. Gated on the admin
 * session independently of the layout UI, since server actions are public endpoints.
 */
export async function setAccountContext(
    clientId: number,
    adAccountId: number,
    note: string,
): Promise<ActionResult> {
    return safeAction(async () => {
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        const trimmed = note.trim();
        if (trimmed.length > MAX_ACCOUNT_CONTEXT) {
            throw new Error(`Context must be ${MAX_ACCOUNT_CONTEXT.toLocaleString("en-US")} characters or fewer.`);
        }

        // Scoped to the selected client, so an id from another client can't be written through this page.
        const { count } = await prisma.adAccount.updateMany({
            where: { id: adAccountId, connection: { client_id: clientId } },
            data: { context_note: trimmed.length > 0 ? trimmed : null },
        });

        if (count === 0) throw new Error("That ad account doesn't belong to this client.");

        revalidatePath("/admin/templates");
        revalidatePath("/dashboard/reports");
    });
}
