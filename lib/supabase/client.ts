import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw Error(`A value for the environment key 'NEXT_PUBLIC_SUPABASE_URL' was not found`);

    const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
    if (!key) throw Error(`A value for the environment key 'NEXT_PUBLIC_SUPABASE_KEY' was not found`);

    return createBrowserClient(url, key);
}
