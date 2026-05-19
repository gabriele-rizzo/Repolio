"use server";

import type { Client } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function authorize(): Promise<Client | null> {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();

    if (error) return null;

    return await prisma.client.findUnique({
        where: { account_id: data.user.id },
    });
}
