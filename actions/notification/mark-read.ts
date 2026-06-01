"use server";

import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markNotificationsRead() {
    const client = await authorize();

    const { count } = await prisma.notification.updateMany({
        where: { client_id: client.id, read_at: null },
        data: { read_at: new Date() },
    });

    // Only revalidate when something changed, to refresh the header badge.
    if (count > 0) revalidatePath("/dashboard", "layout");

    return count;
}
