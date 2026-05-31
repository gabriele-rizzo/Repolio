import { createClient } from "@supabase/supabase-js";
import { checkEnv } from "../env";

// A service-role client with NO user session. Unlike the cookie-based
// `createAdminClient`, this always authenticates as the service role, so it
// bypasses RLS — required for storage writes and signing private objects.
// Server-only: never import from a client component (it reads the secret key).
export function createServiceClient() {
    const url = checkEnv("NEXT_PUBLIC_SUPABASE_URL");
    const key = checkEnv("SUPABASE_SERVICE_ROLE_KEY");

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
