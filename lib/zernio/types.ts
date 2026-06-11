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
export interface ZernioTimelineRow {
    date: string; // YYYY-MM-DD (in the ad account's timezone)
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    engagement?: number;
    ctr: number;
    cpc: number;
    cpm: number;
    conversions: number;
    costPerConversion: number;
    actions?: Record<string, number>;
    actionValues?: Record<string, number>;
    purchaseValue: number;
    roas: number;
}

// What we store in Snapshot.data: a timeline row plus the ad account's currency stamped in
// (timeline rows don't carry currency — it comes from /v1/ads/accounts).
export type SnapshotData = ZernioTimelineRow & { currency: string };
