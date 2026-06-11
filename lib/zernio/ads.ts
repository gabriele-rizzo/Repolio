import { zernioFetch } from "./client";
import type { ZernioAdAccount, ZernioTimelineRow } from "./types";

// GET /v1/ads/accounts — platform ad accounts visible to a SocialAccount (the ads grant).
export async function listAdAccounts(accountId: string): Promise<ZernioAdAccount[]> {
    const { accounts } = await zernioFetch<{ accounts: ZernioAdAccount[] }>("/v1/ads/accounts", {
        query: { accountId },
    });
    return accounts ?? [];
}

// GET /v1/ads/timeline — daily aggregate metrics for one platform ad account, one row per day.
// `fromDate`/`toDate` are YYYY-MM-DD. Returns [] when the account has no activity in the range
// (or Zernio's initial sync hasn't completed yet) — callers must tolerate an empty series.
export async function getTimeline(
    accountId: string,
    adAccountId: string,
    fromDate: string,
    toDate: string,
): Promise<ZernioTimelineRow[]> {
    const { rows } = await zernioFetch<{ rows: ZernioTimelineRow[] }>("/v1/ads/timeline", {
        query: { accountId, adAccountId, fromDate, toDate },
    });
    return rows ?? [];
}
