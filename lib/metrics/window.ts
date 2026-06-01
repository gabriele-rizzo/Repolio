import { prisma } from "@/lib/prisma";
import { computeMetaMetrics, type ComputedMetrics } from "./meta";

export interface WindowMetrics {
    current: ComputedMetrics | null;
    previous: ComputedMetrics | null;
}

/**
 * Computes live metrics for an ad account over [from, to], plus the immediately
 * preceding equal-length window (for period-over-period deltas).
 */
export async function metricsForWindow(adAccountId: number, from: Date, to: Date): Promise<WindowMetrics> {
    const span = Math.max(0, to.getTime() - from.getTime());
    const prevFrom = new Date(from.getTime() - span);

    const [current, previous] = await Promise.all([
        prisma.snapshot.findMany({ where: { ad_account_id: adAccountId, start_date: { gte: from, lte: to } } }),
        prisma.snapshot.findMany({ where: { ad_account_id: adAccountId, start_date: { gte: prevFrom, lt: from } } }),
    ]);

    return {
        current: computeMetaMetrics(current),
        previous: computeMetaMetrics(previous),
    };
}
