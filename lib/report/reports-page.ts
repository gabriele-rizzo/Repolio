import { prisma } from "@/lib/prisma";
import { RELEASED_REPORT } from "@/lib/report/visibility";

export type ReportRef = { id: number; created_at: Date };
export type ReportPage = { items: ReportRef[]; hasMore: boolean };

export const REPORTS_PAGE_SIZE = 12;

/**
 * Cursor-paginated reports for an account, newest first. `cursor` is the id of the last report
 * already shown (omit for the first page); ids and `created_at` are aligned (autoincrement +
 * default now()), so `id < cursor` cleanly continues a `created_at desc` ordering.
 *
 * This is a trusted server query with NO ownership check — callers must have already authorized
 * access to `accountId` (the page resolves it via `getReport`; `listReports` re-checks for clients).
 *
 * Released reports only: this feeds the client's report switcher, so a report still pending admin
 * validation (or excluded during it) must not appear as something to switch to.
 */
export async function queryReportsPage(
    accountId: number,
    cursor?: number,
    limit = REPORTS_PAGE_SIZE,
): Promise<ReportPage> {
    const reports = await prisma.report.findMany({
        where: {
            snapshots: { some: { ad_account_id: accountId } },
            ...RELEASED_REPORT,
            ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { created_at: "desc" },
        take: limit + 1,
        select: { id: true, created_at: true },
    });

    const hasMore = reports.length > limit;
    return { items: hasMore ? reports.slice(0, limit) : reports, hasMore };
}
