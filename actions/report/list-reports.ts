"use server";

import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";
import { queryReportsPage, type ReportPage } from "@/lib/report/reports-page";

/**
 * Client-callable pagination for the report switcher's "Load more". Enforces that `accountId`
 * belongs to the authenticated client, then returns the next page after `cursor`.
 */
export async function listReports(accountId: number, cursor?: number): Promise<ReportPage> {
    const client = await authorize();

    const account = await prisma.adAccount.findFirst({
        where: { id: accountId, connection: { client_id: client.id } },
        select: { id: true },
    });
    if (!account) throw new Error("Account not found");

    return queryReportsPage(accountId, cursor);
}
