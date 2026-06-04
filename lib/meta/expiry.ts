export const REFRESH_THRESHOLD_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type ExpiryState = "active" | "expiring" | "expired" | "unknown";

/**
 * Classifies a connection token's expiry. "expiring" means within REFRESH_THRESHOLD_DAYS of expiry —
 * the window in which the snapshot cron attempts an automatic refresh; "unknown" means no expiry is
 * tracked (nothing to refresh against). Shared by the refresh logic and the account-page indicator
 * so both agree on what "close to expiry" means.
 */
export function expiryState(expiresAt: Date | null | undefined, now: number = Date.now()): ExpiryState {
    if (!expiresAt) return "unknown";
    const msLeft = new Date(expiresAt).getTime() - now;
    if (msLeft <= 0) return "expired";
    if (msLeft <= REFRESH_THRESHOLD_DAYS * DAY_MS) return "expiring";
    return "active";
}
