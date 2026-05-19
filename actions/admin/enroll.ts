"use server";

import type { Client } from "@/generated/prisma/client";
import { checkEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type ClientEnrollment = Pick<Client, "email" | "name" | "company">;

export async function enrollClient({ email, ...data }: ClientEnrollment) {
    const supabase = createAdminClient();
    const baseUrl = checkEnv("NEXT_PUBLIC_SITE_URL");

    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${baseUrl}/auth/confirm`,
        data,
    });

    if (error) throw error;

    revalidatePath("/admin/enrollment");
}
