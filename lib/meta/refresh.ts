import type { PlatformConnection } from "@/generated/prisma/browser";
import { decryptToken, encryptToken } from "@/lib/meta/crypto";
import { expiryState } from "@/lib/meta/expiry";
import { exchangeForLongLivedToken } from "@/lib/meta/oauth";
import { prisma } from "@/lib/prisma";

/**
 * Refreshes a connection's Meta token when it's within the refresh window (or already expired) by
 * re-running the long-lived-token exchange and persisting the new encrypted token + expiry. No-ops
 * when the token is comfortably valid or has no tracked expiry. Throws if the exchange fails (e.g.
 * the token is already dead) — the caller turns that into a client-facing notification.
 */
export async function refreshConnectionIfNeeded(connection: PlatformConnection): Promise<PlatformConnection> {
    const state = expiryState(connection.expires_at);
    if (state === "active" || state === "unknown") return connection;

    const plain = decryptToken(connection.access_token);
    const refreshed = await exchangeForLongLivedToken(plain);

    return prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
            access_token: encryptToken(refreshed.access_token),
            expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
        },
    });
}
