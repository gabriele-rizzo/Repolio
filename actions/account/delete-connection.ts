"use server";

import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function deleteConnection(connectionId: number) {
    const client = await authorize();

    // Scope the delete to the caller's own connection. Cascades to its ad
    // accounts and their snapshots; reports are kept.
    const { count } = await prisma.platformConnection.deleteMany({
        where: { id: connectionId, client_id: client.id },
    });

    if (count === 0) throw new Error("Connection not found.");

    revalidatePath("/dashboard", "layout");
}
