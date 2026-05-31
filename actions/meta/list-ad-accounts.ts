"use server";

import { metaApi } from "@/lib/meta/api";

export type MetaAdAccount = { account_id: string; id: string; name?: string };

export async function metaListAdAccounts(access_token: string): Promise<MetaAdAccount[]> {
    const response = await metaApi<MetaAdAccount>("/me/adaccounts", access_token, ["account_id", "name"]);
    return response.data;
}
