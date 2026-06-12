import { zernioFetch } from "./client";

// A connected SocialAccount (posting or ads grant) under a profile.
export interface ZernioSocialAccount {
    _id: string;
    platform: string;
}

// GET /v1/accounts — connected SocialAccounts in a profile, optionally filtered by health status.
// Used to detect grants that need reconnection (status=disconnected).
export async function listAccounts(
    profileId: string,
    status?: "connected" | "disconnected",
): Promise<ZernioSocialAccount[]> {
    const { accounts } = await zernioFetch<{ accounts: ZernioSocialAccount[] }>("/v1/accounts", {
        query: { profileId, status },
    });
    return accounts ?? [];
}

// DELETE /v1/accounts/{accountId} — disconnects and removes a connected SocialAccount (an ads or
// posting grant) from its profile. Called when a client removes a connection so the grant is freed
// in Zernio too: billing stops, and a later reconnect re-runs OAuth instead of short-circuiting on
// the stale grant. The profile is left in place — empty profiles are free and reused on reconnect.
export async function disconnectAccount(accountId: string): Promise<void> {
    await zernioFetch(`/v1/accounts/${accountId}`, { method: "DELETE" });
}
