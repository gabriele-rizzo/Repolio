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
