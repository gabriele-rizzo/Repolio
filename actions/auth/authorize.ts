"use server";

import type { AccountConnection, Client } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface ConnectedClient extends Omit<Client, "account_id"> {
    accounts: Omit<AccountConnection, "client_id">[];
}

export async function authorize(): Promise<ConnectedClient> {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) redirect("/auth/login");

    const client = await prisma.client.findUnique({
        where: { account_id: data.user.id },
        omit: { account_id: true },
    });

    if (!client) redirect("/auth/login");

    const accounts = await prisma.accountConnection.findMany({
        where: { client_id: client.id },
        omit: { client_id: true },
    });

    return { ...client, accounts };
}
