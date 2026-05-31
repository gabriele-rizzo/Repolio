"use server";

import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateReportContext(reportId: number, comment: string) {
    const trimmed = comment.trim();
    if (trimmed.length > 2000) throw new Error("Context must be 2000 characters or fewer.");

    const client = await authorize();

    // Ownership check via the snapshot -> ad account -> connection -> client chain.
    const { count } = await prisma.report.updateMany({
        where: {
            id: reportId,
            snapshots: { some: { ad_account: { connection: { client_id: client.id } } } },
        },
        data: { context_comment: trimmed.length > 0 ? trimmed : null },
    });

    if (count === 0) throw new Error("Report not found.");

    revalidatePath(`/dashboard/reports/${reportId}`);
}
