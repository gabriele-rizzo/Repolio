"use server";

import { metaApi } from "@/lib/meta/api";

type MetaAdAccount = { account_id: string; id: string };

export async function metaListAdAccounts(access_token: string): Promise<MetaAdAccount[]> {
    const response = await metaApi<MetaAdAccount>("/me/adaccounts", access_token, []);
    return response.data;
}
