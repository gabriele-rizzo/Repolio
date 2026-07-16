import { DAY_MS } from "@/lib/constants";
import { startOfUtcDay } from "@/lib/date/start-of-day";
import { prisma } from "@/lib/prisma";
import { computeMetrics, type ComputedMetrics } from "./compute";

export interface WindowMetrics {
    current: ComputedMetrics | null;
    previous: ComputedMetrics | null;
}

/**
 * Computes live metrics over the UTC days covered by [from, to] (both endpoint days included),
 * plus the immediately preceding window of the same whole-day length (for period-over-period
 * deltas). Snapshots are keyed one per UTC day at exact UTC midnight (see fetch-snapshot), so
 * both bounds are floored to UTC days and both windows queried half-open — otherwise the two
 * windows cover unequal day counts and every delta skews.
 */
export async function metricsForWindow(adAccountId: number, from: Date, to: Date): Promise<WindowMetrics> {
    const currentFrom = startOfUtcDay(from);
    const currentTo = new Date(startOfUtcDay(to).getTime() + DAY_MS); // exclusive end: includes all of to's UTC day
    const span = Math.max(0, currentTo.getTime() - currentFrom.getTime());
    const prevFrom = new Date(currentFrom.getTime() - span);

    const [current, previous] = await Promise.all([
        prisma.snapshot.findMany({ where: { ad_account_id: adAccountId, start_date: { gte: currentFrom, lt: currentTo } } }),
        prisma.snapshot.findMany({ where: { ad_account_id: adAccountId, start_date: { gte: prevFrom, lt: currentFrom } } }),
    ]);

    return {
        current: computeMetrics(current),
        previous: computeMetrics(previous),
    };
}
