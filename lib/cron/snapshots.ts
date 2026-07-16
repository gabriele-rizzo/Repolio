import { collectSnapshots } from "@/actions/snapshot/collect-snapshots";
import { prisma } from "@/lib/prisma";
import { pruneSyncErrors } from "@/lib/sync-error";
import { settle } from "@/lib/try-catch";
import pLimit from "p-limit";

// Daily snapshot collection for every active client. Extracted from the route so it can be run
// both standalone (/api/cron/snapshots) and as the first phase of the combined /api/cron/daily job.

const limit = pLimit(10);

export async function runSnapshots(): Promise<{ status: number; error: string | null }> {
    await pruneSyncErrors();

    const clients = await prisma.client.findMany({ where: { active: true } });

    const result = settle("snapshots", await Promise.all(clients.map((c) => limit(() => collectSnapshots(c)))));

    const okCount = result.data?.length ?? 0;
    console.log(`[snapshots] done clients=${clients.length} ok=${okCount} failed=${clients.length - okCount}`);

    if (result.error) return { status: 500, error: result.error };

    return { status: 200, error: null };
}
