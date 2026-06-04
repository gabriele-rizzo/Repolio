## Fixes

### #1 🟡 `fetchSnapshot` uses the wrong date semantics

**File:** `actions/snapshot/fetch-snapshot.ts`

```ts
const start_date = last?.created_at ?? adAccount.created_at;
```

Using `created_at` (insertion timestamp) as the next snapshot's `start_date` (period start) has two problems:

1. Vercel Cron runs are not punctual to the second — `start_date` drifts over weeks.
2. A missed cron run creates a coverage gap that's invisible from the data.
3. Semantically `start_date` is meant to be "beginning of the period covered", not "when the previous row was inserted".

**Important:** the correct fix depends on whether snapshots come from the real Meta Insights API (which exposes `date_start` / `date_stop`). This should be implemented **together with #11**: once `fetchSnapshot` calls the real API, the snapshot's `start_date` should be derived from the API response, not from `last.created_at`.

**Action now:** leave the code as-is until #11 lands, then refactor `fetchSnapshot` to compute `start_date` from `last?.start_date` (or the API's returned `date_stop` of the previous period).

### #2 🟠 Real Meta Insights API adapter

**Files:** `actions/snapshot/fetch-snapshot.ts`, extension of `lib/meta/api.ts`, new `lib/meta/insights.ts`

The single line `TODO: use real api point` is the largest gap in the codebase — every report currently runs on randomized mock data.

**Step-by-step:**

1. **Extend `metaApi()` in `lib/meta/api.ts`** to accept arbitrary extra query params:

    ```ts
    export async function metaApi<T extends object>(
        path: string,
        access_token: string,
        fields: string[],
        extraParams: Record<string, string> = {},
    ): Promise<MetaApiResponse<T>> {
        const version = checkEnv("META_GRAPH_API_VERSION");
        const base = { access_token, limit: "100", ...extraParams };
        const params = new URLSearchParams(fields.length === 0 ? base : { ...base, fields: fields.join(",") });
        // ... rest unchanged
    }
    ```

2. **New `lib/meta/insights.ts`** with a typed `fetchInsights()`:

    ```ts
    const FIELDS = [
        "spend",
        "impressions",
        "clicks",
        "reach",
        "frequency",
        "actions",
        "action_values",
        "objective",
        "date_start",
        "date_stop",
        "account_id",
        "account_currency",
    ];

    const iso = (d: Date) => d.toISOString().slice(0, 10);

    export async function fetchInsights(adAccountExternalId: string, accessToken: string, since: Date, until: Date) {
        return metaApi(`/${adAccountExternalId}/insights`, accessToken, FIELDS, {
            level: "account",
            time_range: JSON.stringify({ since: iso(since), until: iso(until) }),
            action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
        });
    }
    ```

3. **Rewrite `fetchSnapshot`**

    ```ts
    import { decryptToken } from "@/lib/meta/crypto";
    import { fetchInsights } from "@/lib/meta/insights";

    if (platform === "META") {
        const last = await prisma.snapshot.findFirst({
            where: { platform: "META", ad_account_id: adAccount.id },
            orderBy: { start_date: "desc" },
            select: { start_date: true },
        });

        const since = last?.start_date ?? adAccount.created_at; // fixes #8
        const until = new Date();

        try {
            const token = decryptToken(adAccount.connection.access_token);
            const data = await fetchInsights(adAccount.external_id, token, since, until);
            return ok({ data, ad_account_id: adAccount.id, start_date: since, platform: "META" });
        } catch (e) {
            return err(`Meta insights fetch failed for ad_account ${adAccount.id}: ${String(e)}`);
        }
    }
    ```

4. **Delete `lib/data/mock-meta-snapshot.ts`** and its import. Update the `TODO` file to reflect what's now done.

5. **Testing strategy:**
    - Provision a Meta developer sandbox account with a test ad account.
    - Connect via the OAuth flow in dev → confirm the encrypted token round-trips.
    - Run `/api/cron/snapshots` manually → confirm one snapshot row per ad account, with realistic Meta data.
    - Verify `computeMetaMetrics` accepts the real response shape (the existing `MetaInsightsRow` type was modeled on real Meta data, so this should mostly work).

**Acceptance:** real ad accounts produce snapshots whose KPIs match Meta Ads Manager for the same period (±rounding).
