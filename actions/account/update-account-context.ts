"use server";

import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";
import { MAX_ACCOUNT_CONTEXT } from "@/lib/report/account-context";
import { revalidatePath } from "next/cache";

/**
 * Sets the standing context for one ad account: background the AI is given for EVERY report on that
 * account from the next generation onwards.
 *
 * Distinct from `updateReportContext`, which annotates a single period. This one is read when the prompt
 * is built, so unlike the per-report note it genuinely reaches the model.
 */
export async function updateAccountContext(adAccountId: number, note: string): Promise<void> {
    const trimmed = note.trim();
    if (trimmed.length > MAX_ACCOUNT_CONTEXT) {
        throw new Error(`Context must be ${MAX_ACCOUNT_CONTEXT.toLocaleString("en-US")} characters or fewer.`);
    }

    const client = await authorize();

    // Ownership check via the connection chain; updateMany so a foreign id simply matches nothing.
    const { count } = await prisma.adAccount.updateMany({
        where: { id: adAccountId, connection: { client_id: client.id } },
        data: { context_note: trimmed.length > 0 ? trimmed : null },
    });

    if (count === 0) throw new Error("Ad account not found.");

    revalidatePath("/dashboard/account");
    revalidatePath("/dashboard/reports");
}
