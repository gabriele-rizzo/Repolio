import { collectSnapshots } from "@/actions/snapshot/collect-snapshots";
import type { Client } from "@/generated/prisma/browser";
import type { Budget } from "@/lib/cron/budget";
import { emptyCounts, type PhaseCounts } from "@/lib/cron/run-record";
import { prisma } from "@/lib/prisma";
import { logSyncError, pruneSyncErrors } from "@/lib/sync-error";
import pLimit from "p-limit";

// Daily snapshot collection for every active client. Extracted from the route so it can be run
// both standalone (/api/cron/snapshots) and as the first phase of the combined /api/cron/daily job.

const limit = pLimit(10);

/**
 * Active clients, staleness-first: never-synced accounts, then oldest successful sync, then by id.
 *
 * The order is what makes a budget-truncated run self-healing. Under the previous arbitrary order
 * (`findMany` — effectively insertion order), an overrun starved the SAME tail clients every single
 * day: they were last in the queue on every run, so they were the ones cut off on every run, and
 * their data silently stopped advancing while everyone ahead of them looked fine. Sorting by
 * staleness means being skipped today puts a client at the FRONT tomorrow, so the deficit corrects
 * itself instead of compounding.
 *
 * `MIN(last_synced_at)` ignores NULLs in Postgres, so a client with one never-synced account and one
 * healthy one would sort by the healthy timestamp — hence the explicit never-synced flag first.
 * Clients with no active ad accounts sort last (NULLS LAST): there is nothing to pull for them, and
 * they should not occupy the head of the queue.
 */
async function activeClientsByStaleness(): Promise<Client[]> {
    const clients = await prisma.client.findMany({ where: { active: true } });
    if (clients.length <= 1) return clients;

    // Ordering only — the full rows come from Prisma above, since collectSnapshots needs a Client.
    // Prisma can't express "min over a two-hop relation" as an orderBy, the same reason HomeOverview
    // and /admin/schedule use raw GROUP BY queries (see PROJECT_OVERVIEW.md §9, "Query shape").
    let order: { id: number }[];
    try {
        order = await prisma.$queryRaw<{ id: number }[]>`
            SELECT c."id"
            FROM "Client" c
            LEFT JOIN "PlatformConnection" p ON p."client_id" = c."id"
            LEFT JOIN "AdAccount" a ON a."connection_id" = p."id" AND a."active" = true
            WHERE c."active" = true
            GROUP BY c."id"
            ORDER BY
                (COUNT(a."id") FILTER (WHERE a."last_synced_at" IS NULL)) > 0 DESC,
                MIN(a."last_synced_at") ASC NULLS LAST,
                c."id" ASC
        `;
    } catch (error) {
        // Ordering is an optimisation, not a correctness requirement — a failure here must not stop
        // collection. Fall back to whatever order Prisma gave us.
        console.error("Failed to order clients by staleness, using default order:", error);
        return clients;
    }

    const rank = new Map(order.map((row, index) => [row.id, index]));
    // Clients missing from the ranking (raced in between the two queries) go last, still processed.
    return [...clients].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

/**
 * Collects snapshots for every active client, stopping cleanly when `budget` runs out.
 *
 * The budget check is INSIDE the limited task, not around the loop: p-limit queues all tasks up front
 * and starts them as slots free, so "is there still time?" is only meaningful at the moment a task
 * actually begins. A task that starts late abandons itself and is counted as skipped — a deliberate,
 * recorded deferral instead of a mid-write kill by the platform.
 */
export async function runSnapshots(budget: Budget): Promise<{ status: number; error: string | null; counts: PhaseCounts }> {
    await pruneSyncErrors();

    const clients = await activeClientsByStaleness();
    const counts = { ...emptyCounts(), considered: clients.length };
    const skippedIds: number[] = [];

    // Per-client isolation: collectSnapshots normally returns a Result, but its unguarded DB reads
    // can reject. A bare Promise.all rejects on the first such throw, aborting collection for every
    // other client — one bad client would blackout the whole run. Convert any throw into a counted
    // failure so the healthy clients still get collected.
    await Promise.all(
        clients.map((c) =>
            limit(async () => {
                if (!budget.canStart()) {
                    counts.skipped++;
                    skippedIds.push(c.id);
                    return;
                }

                try {
                    const result = await collectSnapshots(c);
                    if (result.error) {
                        counts.failed++;
                        console.error(`[snapshots] client ${c.id} failed: ${result.error}`);
                    } else counts.processed++;
                } catch (error) {
                    counts.failed++;
                    const message = `collectSnapshots threw for client '${c.id}': ${String(error)}`;
                    console.error(message);
                    await logSyncError({ stage: "collect_snapshots", clientId: c.id, message });
                }
            }),
        ),
    );

    if (counts.skipped > 0) {
        // Recorded, not just logged: a truncated run is the failure mode with no exception attached,
        // so this row is the only durable trace that these clients were passed over today. They sort
        // to the front of tomorrow's queue.
        const message =
            `snapshot phase ran out of wall clock after ${budget.elapsed()}ms — ` +
            `deferred ${counts.skipped}/${counts.considered} clients to the next run (ids: ${skippedIds.join(", ")})`;
        console.error(`[snapshots] ${message}`);
        await logSyncError({ stage: "snapshots_budget_exhausted", message });
    }

    // A run where nothing succeeded AND something was attempted is a real failure; a run that merely
    // deferred work is not. Skipping is the budget working as designed.
    if (counts.processed === 0 && counts.failed > 0) {
        return { status: 500, error: `No client collected successfully out of ${counts.failed} attempted (check logs).`, counts };
    }

    return { status: 200, error: null, counts };
}
