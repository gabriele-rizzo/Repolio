import { createClient } from "@supabase/supabase-js";
import { checkEnv } from "../env";

export function createAdminClient() {
    const url = checkEnv("NEXT_PUBLIC_SUPABASE_URL");
    const key = checkEnv("SUPABASE_SERVICE_ROLE_KEY");

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
