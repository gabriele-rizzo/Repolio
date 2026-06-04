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

### #2 🟡 Hardcoded EUR currency

**Files:**

- `components/wrappers/report-wrapper.tsx`
- `app/dashboard/page.tsx`
- `lib/email/render-report.tsx` (verify; same pattern likely used in the email template)

Both report and dashboard format money with a fixed EUR formatter:

```ts
const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
```

The mock already includes `account_currency: "EUR"`. Meta's real API returns the actual account currency. Non-EUR clients would see wrong currency symbols.

**Fix in 4 steps:**

1. **Extend `ComputedMetrics`** in `lib/metrics/meta.ts`:

    ```ts
    export interface ComputedMetrics {
        // existing fields...
        currency: string;
    }
    ```

2. **Read currency in `computeMetaMetrics`** (Meta returns it per row as `account_currency`):

    ```ts
    const currency =
        (
            rows.find((r) => (r as { account_currency?: string }).account_currency) as
                | { account_currency?: string }
                | undefined
        )?.account_currency ?? "EUR";
    ```

    Also extend the `MetaInsightsRow` type to include the optional field.

3. **Make formatters dynamic:**

    ```ts
    const formatCurrency = (code: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: code });
    ```

4. **Pass currency through props:** `ReportView` → `ReportWrapper` → `MetricCard` gain a `currencyCode` prop; dashboard cards read it from each account's computed metrics.

**Verification:** edit `lib/data/mock-meta-snapshot.ts` to return `account_currency: "USD"` → the UI shows `$` consistently.

### #3 🟢 Pagination for the report switcher

**File:** `app/dashboard/reports/[id]/page.tsx`

```ts
prisma.report.findMany({
    where: { snapshots: { some: { ad_account_id: account.id } } },
    orderBy: { created_at: "desc" },
    take: 12,
    select: { id: true, created_at: true },
});
```

After 12 reports older ones disappear from the switcher with no way to access them. At a default 30-day cadence this gates at ~1 year of history.

**Fix plan:**

1. **New server action** `actions/report/list-reports.ts`:

    ```ts
    "use server";
    export async function listReports(accountId: number, cursor?: number, limit = 12) {
        const client = await authorize();
        const account = await prisma.adAccount.findFirst({
            where: { id: accountId, connection: { client_id: client.id } },
            select: { id: true },
        });
        if (!account) throw new Error("Account not found");
        const reports = await prisma.report.findMany({
            where: {
                snapshots: { some: { ad_account_id: accountId } },
                ...(cursor ? { id: { lt: cursor } } : {}),
            },
            orderBy: { created_at: "desc" },
            take: limit + 1,
            select: { id: true, created_at: true },
        });
        const hasMore = reports.length > limit;
        return { items: hasMore ? reports.slice(0, limit) : reports, hasMore };
    }
    ```

2. **Convert `ReportSwitcher` to a client component**, seed it with the initial 12 from the server, and add a "Load more" button that calls `listReports` via `useTransition` to fetch the next page.

**Verification:** insert 15+ test reports → switcher initially shows 12, "Load more" reveals older ones.

### #3 🟠 Real Meta Insights API adapter

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

3. **Rewrite `fetchSnapshot`** (this is also where #8 gets fixed naturally):

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

### #4 🟠 Automatic Meta token refresh

**Files:** new `lib/meta/refresh.ts`, changes to `actions/snapshot/collect-snapshots.ts`, Prisma schema migration, notification handling.

Meta long-lived tokens expire after ~60 days. Today expired connections are silently filtered out of `usable`. There is no refresh, no warning, and no client-facing signal.

**Step-by-step:**

1. **New `lib/meta/refresh.ts`:**

    ```ts
    import { decryptToken, encryptToken } from "@/lib/meta/crypto";
    import { exchangeForLongLivedToken } from "@/lib/meta/oauth";
    import { prisma } from "@/lib/prisma";
    import type { PlatformConnection } from "@/generated/prisma/browser";

    const REFRESH_THRESHOLD_DAYS = 7;
    const DAY_MS = 24 * 60 * 60 * 1000;

    export async function refreshConnectionIfNeeded(connection: PlatformConnection): Promise<PlatformConnection> {
        if (!connection.expires_at) return connection;
        const daysLeft = (new Date(connection.expires_at).getTime() - Date.now()) / DAY_MS;
        if (daysLeft > REFRESH_THRESHOLD_DAYS) return connection;

        const plain = decryptToken(connection.access_token);
        const refreshed = await exchangeForLongLivedToken(plain);

        return prisma.platformConnection.update({
            where: { id: connection.id },
            data: {
                access_token: encryptToken(refreshed.access_token),
                expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
            },
        });
    }
    ```

2. **In `collectSnapshots`** — refresh before filtering:

    ```ts
    await Promise.all(
        adAccounts.map(async (a) => {
            try {
                await refreshConnectionIfNeeded(a.connection);
            } catch (e) {
                console.error(`Token refresh failed for connection ${a.connection.id}:`, e);
                // create CONNECTION_EXPIRED notification for the client
            }
        }),
    );
    // Re-read after refresh so `expires_at` and `access_token` are current
    const reloaded = await prisma.adAccount.findMany({
        where: { active: true, connection: { client_id: client.id } },
        include: { connection: true },
    });
    // continue with `reloaded` instead of `adAccounts`
    ```

3. **Prisma schema migration** — extend `NotificationType`:

    ```prisma
    enum NotificationType {
        REPORT_READY
        CONNECTION_EXPIRING
        CONNECTION_EXPIRED
    }
    ```

    Generate a new Prisma migration for this.

4. **Notification creation:**
    - On refresh failure: create `CONNECTION_EXPIRED` notification + send email asking the client to reconnect.
    - On successful refresh of an expiring token: optionally create a `CONNECTION_EXPIRING` info notification (could be skipped if seamless).

5. **Add an indicator in `app/dashboard/account/page.tsx`** showing each connection's expiry state — already partly there via `expires_at`, just needs a warning style when close to expiry.

**Acceptance:** a connection 5 days from expiry gets silently refreshed on the next snapshot cron run. A connection whose refresh fails produces a notification visible in the bell and an email to the client.
