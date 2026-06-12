"use server";

import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";
import { disconnectAccount } from "@/lib/zernio/accounts";
import { ZernioError } from "@/lib/zernio/client";
import { revalidatePath } from "next/cache";

export async function deleteConnection(connectionId: number) {
    const client = await authorize();

    // Read first (scoped to the caller) so we hold the Zernio grant ids before the local row — and
    // its cascaded ad accounts and snapshots — are gone.
    const connection = await prisma.platformConnection.findFirst({
        where: { id: connectionId, client_id: client.id },
        select: { zernio_account_id: true, zernio_posting_account_id: true },
    });
    if (!connection) throw new Error("Connection not found.");

    // Free the grant(s) in Zernio first. Without this the account lingers there — billing keeps
    // running, and a later reconnect silently short-circuits on the stale grant (no OAuth, no ad-
    // account re-selection). A 404 means it's already gone, so treat it as success; any other
    // failure aborts before the local delete so we never orphan a still-connected account and the
    // user can retry.
    const grantIds = [connection.zernio_account_id, connection.zernio_posting_account_id].filter(
        (id): id is string => id != null,
    );
    for (const grantId of grantIds) {
        try {
            await disconnectAccount(grantId);
        } catch (error) {
            if (error instanceof ZernioError && error.status === 404) continue;
            console.error(`Failed to disconnect Zernio account ${grantId} for client ${client.id}:`, error);
            throw new Error("Couldn't fully remove the connection. Please try again.");
        }
    }

    // Cascades to its ad accounts and their snapshots; reports are kept.
    await prisma.platformConnection.deleteMany({
        where: { id: connectionId, client_id: client.id },
    });

    revalidatePath("/dashboard", "layout");
}
