"use server";

import type { Client } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

export type FetchedReport = NonNullable<Awaited<ReturnType<typeof getReport>>>;

// A report now carries only the AI output. We also resolve the account it belongs
// to and the period it covered, so the page can compute KPIs live for that window.
export async function getReport(id: string, client_id: Client["id"]) {
    if (isNaN(+id)) return null;

    const report = await prisma.report.findFirst({
        where: { id: parseInt(id), snapshots: { some: { ad_account: { connection: { client_id } } } } },
        include: {
            snapshots: {
                orderBy: { start_date: "asc" },
                select: { start_date: true, ad_account_id: true, platform: true },
            },
        },
    });

    if (!report) return null;

    const first = report.snapshots[0];
    const from = first?.start_date ?? report.created_at;
    const to = report.created_at;

    const account = first
        ? await prisma.adAccount.findUnique({
              where: { id: first.ad_account_id },
              select: { id: true, name: true, connection: { select: { platform: true } } },
          })
        : null;

    return { report, account, from, to };
}
