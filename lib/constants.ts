// Shared time constants. Relocated from the (removed) lib/meta/expiry.ts so snapshot
// collection's notification rate-limit no longer depends on the deleted Meta module.
export const DAY_MS = 24 * 60 * 60 * 1000;

// Minimum gap between repeated CONNECTION_EXPIRED notices for the same client, so a
// persistently-disconnected account doesn't email them every day.
export const REFRESH_THRESHOLD_DAYS = 7;
