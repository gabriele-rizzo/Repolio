"use server";

import { safeAction } from "@/lib/action";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function login(email: string, password: string) {
    return safeAction(async () => {
        const supabase = await createClient();
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        revalidatePath("/auth/login");
    });
}
