import { zernioFetch } from "./client";
import type { ZernioProfile } from "./types";

// POST /v1/profiles — create a Profile (container for one client's connections).
// Throws ZernioError with status 402/403 when the workspace plan's profile cap is hit.
export async function createProfile(name: string): Promise<ZernioProfile> {
    const { profile } = await zernioFetch<{ profile: ZernioProfile }>("/v1/profiles", {
        method: "POST",
        body: { name },
    });
    return profile;
}

// DELETE /v1/profiles/{id} — only succeeds while the profile has no connected accounts.
export async function deleteProfile(profileId: string): Promise<void> {
    await zernioFetch(`/v1/profiles/${profileId}`, { method: "DELETE" });
}
