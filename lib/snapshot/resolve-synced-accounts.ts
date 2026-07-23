export interface UpsertOutcome {
    adAccountId: number;
    ok: boolean;
}

/**
 * Decide which ad accounts are safe to stamp as freshly synced after a batch of per-day snapshot
 * upserts, and which had failures.
 *
 * The invariant: an account is stamped only if EVERY one of its upserts landed. Snapshot upserts
 * run un-transacted and concurrently, so a large backfill can commit some days for an account and
 * fail others. Such an account is mid-backfill — stamping it would make `last_synced_at` look
 * healthy and hide it from the "which account stopped syncing" (stale >48h) check, while the
 * un-committed trailing days silently never heal. So any failed upsert excludes that whole account
 * from stamping; the next run re-pulls and re-upserts its missing days.
 *
 * @param outcomes one entry per attempted upsert (its account + whether it succeeded)
 * @param fetchedAccountIds accounts whose Zernio fetch round-tripped (stamping candidates)
 */
export function resolveSyncedAccounts(
    outcomes: UpsertOutcome[],
    fetchedAccountIds: number[],
): { syncedAccountIds: number[]; failedAccountIds: number[] } {
    const failed = new Set<number>();
    for (const o of outcomes) if (!o.ok) failed.add(o.adAccountId);
    return {
        syncedAccountIds: fetchedAccountIds.filter((id) => !failed.has(id)),
        failedAccountIds: [...failed],
    };
}
