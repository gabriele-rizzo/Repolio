"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePassword(password: string) {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) throw error;

    revalidatePath("/auth/set-password");
}
