import { collectSnapshots } from "@/actions/snapshot/collect-snapshots";
import { prisma } from "@/lib/prisma";
import { pruneSyncErrors } from "@/lib/sync-error";
import { err, settle } from "@/lib/try-catch";
import pLimit from "p-limit";

// Daily snapshot collection for every active client. Extracted from the route so it can be run
// both standalone (/api/cron/snapshots) and as the first phase of the combined /api/cron/daily job.

const limit = pLimit(10);

export async function runSnapshots(): Promise<{ status: number; error: string | null }> {
    await pruneSyncErrors();

    const clients = await prisma.client.findMany({ where: { active: true } });

    // Per-client isolation: collectSnapshots normally returns a Result, but its unguarded DB reads
    // can reject. A bare Promise.all rejects on the first such throw, aborting collection for every
    // other client — one bad client would blackout the whole run. Convert any throw into a Result
    // so settle() sees a failure it can log while the healthy clients still get collected.
    const outcomes = await Promise.all(
        clients.map((c) =>
            limit(async () => {
                try {
                    return await collectSnapshots(c);
                } catch (error) {
                    const message = `collectSnapshots threw for client '${c.id}': ${String(error)}`;
                    console.error(message);
                    return err(message);
                }
            }),
        ),
    );

    const result = settle("snapshots", outcomes);

    const okCount = result.data?.length ?? 0;
    console.log(`[snapshots] done clients=${clients.length} ok=${okCount} failed=${clients.length - okCount}`);

    if (result.error) return { status: 500, error: result.error };

    return { status: 200, error: null };
}
