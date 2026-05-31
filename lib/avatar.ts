import { createServiceClient } from "./supabase/service";

// Private bucket: objects are never public, access is via short-lived signed URLs.
export const AVATAR_BUCKET = "Avatars";

const SIGNED_URL_TTL = 60 * 60; // seconds

// Resolves a stored avatar object path into a signed URL. Returns null when there
// is no avatar or signing fails (callers fall back to initials). Server-only.
export async function signAvatarUrl(path: string | null): Promise<string | null> {
    if (!path) return null;

    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);

    if (error || !data) return null;
    return data.signedUrl;
}
