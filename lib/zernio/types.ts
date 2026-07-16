// Minimal shapes for the Zernio responses Repolio consumes — only the fields we read.
// Full schemas live in the Zernio OpenAPI spec.

export interface ZernioProfile {
    _id: string;
    name: string;
}

// GET /v1/ads/accounts — a platform ad account under a SocialAccount.
export interface ZernioAdAccount {
    id: string; // platform ad-account id (e.g. Meta act_123)
    name?: string;
    currency?: string;
    status?: string;
    timezoneName?: string;
}

// GET /v1/ads/timeline — one calendar day of aggregated ad metrics for an account.
//
// Zernio's derived scalars on this row are UNTRUSTED for KPIs and stored only as provenance:
// - `conversions` / `costPerConversion` mirror Meta's pixel-config-dependent conversions rollup
//   (identical action patterns produced 2 vs 0 across accounts).
// - `purchaseValue` / `roas` mix non-purchase action values into "revenue" (lead values produced
//   a client-visible fake 74.5x ROAS).
// - per-day `ctr` / `cpc` / `cpm` must never be averaged across days.
// KPIs derive from the raw `actions` / `actionValues` maps via lib/metrics/extract.ts and are
// recomputed from summed totals in lib/metrics/compute.ts.
export interface ZernioTimelineRow {
    date: string; // YYYY-MM-DD (in the ad account's timezone)
    spend: number;
    impressions: number;
    reach: number;
    clicks: number; // all clicks — link clicks live in actions.link_click
    /** Vanity metric, excluded from Repolio's data set — stripped before store. */
    engagement?: number;
    ctr: number;
    cpc: number;
    cpm: number;
    conversions: number;
    costPerConversion: number;
    /** Meta actions[]: action_type -> count. Source of truth for conversion counts. */
    actions?: Record<string, number>;
    /** Meta action_values[]: action_type -> value. Source of truth for purchase revenue. */
    actionValues?: Record<string, number>;
    purchaseValue: number;
    roas: number;
}

// What we store in Snapshot.data: a timeline row (minus excluded vanity metrics) plus the ad
// account's currency stamped in (timeline rows don't carry currency — it comes from /v1/ads/accounts).
export type SnapshotData = Omit<ZernioTimelineRow, "engagement"> & { currency: string };
