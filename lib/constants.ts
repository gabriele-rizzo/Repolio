// Shared time constants. Relocated from the (removed) lib/meta/expiry.ts so snapshot
// collection's notification rate-limit no longer depends on the deleted Meta module.
export const DAY_MS = 24 * 60 * 60 * 1000;

// Minimum gap between repeated CONNECTION_EXPIRED notices for the same client, so a
// persistently-disconnected account doesn't email them every day.
export const REFRESH_THRESHOLD_DAYS = 7;

// Oldest day any snapshot can exist for: Zernio's timeline range cap, and therefore the horizon a
// first-ever backfill reaches (actions/snapshot/fetch-snapshot.ts). Shared with /api/metrics, which
// refuses windows longer than this — beyond it there is no data to find, so a longer range can only
// cost query time.
export const MAX_BACKFILL_DAYS = 730;
