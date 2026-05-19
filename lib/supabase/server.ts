import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkEnv } from "../env";

export async function createClient() {
    const store = await cookies();

    const url = checkEnv("NEXT_PUBLIC_SUPABASE_URL");
    const key = checkEnv("NEXT_PUBLIC_SUPABASE_KEY");

    return createServerClient(url, key, {
        cookies: {
            getAll: () => store.getAll(),
            setAll: (cookies) => {
                try {
                    for (const { name, value, options } of cookies) {
                        store.set(name, value, options);
                    }
                } catch {
                    // The `setAll` method was called from a Server Component.
                    // This can be ignored if you have middleware refreshing
                    // user sessions.
                }
            },
        },
    });
}
