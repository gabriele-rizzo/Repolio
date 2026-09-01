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

// Ranges one recovery re-pull request may START (actions/admin/snapshot-recovery.ts). Each range is
// its own Zernio round-trip inside a single serverless invocation, so this is a request-sized bite,
// NOT a limit on how much an admin may heal in one click — the recovery UI chunks a larger selection
// into this many per call. It lives here rather than in the action because a "use server" module may
// only export async functions, so the client cannot import the number from there.
export const RECOVERY_RANGES_PER_REQUEST = 40;
