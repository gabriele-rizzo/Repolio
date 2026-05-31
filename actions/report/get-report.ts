"use server";

import type { Client } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

export type FetchedReport = NonNullable<Awaited<ReturnType<typeof getReport>>>;

export async function getReport(id: string, client_id: Client["id"]) {
    if (isNaN(+id)) return null;

    const report = await prisma.report.findFirst({
        where: { id: parseInt(id), snapshots: { some: { ad_account: { connection: { client_id } } } } },
        include: {
            snapshots: {
                orderBy: { start_date: "asc" },
                take: 1,
            },
        },
    });

    if (!report) return null;

    // Last 6 reports (including current) for this client, chronological order.
    const recent = await prisma.report.findMany({
        where: {
            created_at: { lte: report.created_at },
            snapshots: { some: { ad_account: { connection: { client_id } } } },
        },
        orderBy: { created_at: "desc" },
        take: 6,
        select: { id: true, created_at: true, performance_score: true },
    });

    // `recent` is descending by created_at, so the first non-current entry is the most recent prior report.
    const prior = recent.find((r) => r.id !== report.id);
    const history = [...recent].reverse();

    // Pull the metric fields of the prior report so cards can render deltas.
    const previous = prior
        ? await prisma.report.findUnique({
              where: { id: prior.id },
              select: {
                  spend: true,
                  revenue: true,
                  impressions: true,
                  clicks: true,
                  conversions: true,
                  reach: true,
                  frequency: true,
                  ctr: true,
                  cpm: true,
                  cpa: true,
                  cpc: true,
                  roas: true,
              },
          })
        : null;

    return {
        ...report,
        previous_score: prior?.performance_score ?? null,
        previous,
        history,
    };
}
