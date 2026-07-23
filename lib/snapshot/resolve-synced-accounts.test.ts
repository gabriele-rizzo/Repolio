import { describe, expect, it } from "vitest";
import { resolveSyncedAccounts } from "./resolve-synced-accounts";

describe("resolveSyncedAccounts", () => {
    it("stamps every account when all upserts land", () => {
        const { syncedAccountIds, failedAccountIds } = resolveSyncedAccounts(
            [
                { adAccountId: 1, ok: true },
                { adAccountId: 1, ok: true },
                { adAccountId: 2, ok: true },
            ],
            [1, 2],
        );
        expect(syncedAccountIds).toEqual([1, 2]);
        expect(failedAccountIds).toEqual([]);
    });

    it("excludes an account from stamping if ANY of its upserts failed, even when others succeeded", () => {
        // The regression this guards: account 1 committed one day but failed another (a partial
        // backfill). It must NOT be stamped — it is mid-backfill and its stale marker must stand so
        // the trailing re-pull heals it next run. Account 2 is fully clean and still gets stamped.
        const { syncedAccountIds, failedAccountIds } = resolveSyncedAccounts(
            [
                { adAccountId: 1, ok: true },
                { adAccountId: 1, ok: false },
                { adAccountId: 2, ok: true },
            ],
            [1, 2],
        );
        expect(syncedAccountIds).toEqual([2]);
        expect(failedAccountIds).toEqual([1]);
    });

    it("stamps nothing when the fetched-accounts list is empty", () => {
        const { syncedAccountIds } = resolveSyncedAccounts([{ adAccountId: 9, ok: true }], []);
        expect(syncedAccountIds).toEqual([]);
    });

    it("never stamps an account that was not among the fetched accounts", () => {
        // Only accounts whose fetch round-tripped are stamping candidates; a stray outcome for some
        // other account must not introduce it.
        const { syncedAccountIds } = resolveSyncedAccounts([{ adAccountId: 3, ok: true }], [1, 2]);
        expect(syncedAccountIds).toEqual([1, 2]);
    });
});
