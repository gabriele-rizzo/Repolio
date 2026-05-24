"use server";

import type { Client } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface ConnectedClient extends Omit<Client, "account_id"> {
    // accounts: Omit<AccountConnection, "client_id">[];
}

export async function getCurrentClient(): Promise<ConnectedClient | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const client = await prisma.client.findUnique({
        where: { account_id: data.user.id },
        omit: { account_id: true },
    });

    return client ?? null;
}

export async function authorize(): Promise<ConnectedClient> {
    const client = await getCurrentClient();
    if (!client) redirect("/auth/login");
    return client;
}
