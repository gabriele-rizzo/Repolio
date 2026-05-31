"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateName(name: string) {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new Error("Name cannot be empty.");
    if (trimmed.length > 80) throw new Error("Name must be 80 characters or fewer.");

    // Update the auth user's metadata (merges, so `company` is preserved). A
    // database trigger on auth.users propagates the change to the Client row.
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ data: { name: trimmed } });
    if (error) throw error;

    revalidatePath("/dashboard", "layout");
}
