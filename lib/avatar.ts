import { unstable_cache } from "next/cache";
import { createServiceClient } from "./supabase/service";

// Private bucket: objects are never public, access is via short-lived signed URLs.
export const AVATAR_BUCKET = "Avatars";

const SIGNED_URL_TTL = 60 * 60; // seconds — how long each signed URL stays valid
// Re-sign comfortably before expiry so a cached URL is never served once it's dead. The dashboard
// layout signs the avatar on every (non-soft) navigation; without this it was a Storage API round
// trip each time, on the critical render path.
const CACHE_TTL = 50 * 60; // seconds

async function createSignedAvatarUrl(path: string): Promise<string | null> {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);

    if (error || !data) return null;
    return data.signedUrl;
}

// Cached per object path. The signer uses the service role only (no per-request cookies/headers),
// so the result is safely shareable across requests for the same path until it revalidates.
const cachedSignedAvatarUrl = unstable_cache(createSignedAvatarUrl, ["avatar-signed-url"], { revalidate: CACHE_TTL });

// Resolves a stored avatar object path into a signed URL. Returns null when there
// is no avatar or signing fails (callers fall back to initials). Server-only.
export async function signAvatarUrl(path: string | null): Promise<string | null> {
    if (!path) return null;
    return cachedSignedAvatarUrl(path);
}
