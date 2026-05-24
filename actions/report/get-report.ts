"use server";

import type { Client } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

export async function getReport(id: string, client_id: Client["id"]) {
    if (isNaN(+id)) return null;

    return await prisma.report.findFirst({
        where: { id: parseInt(id), snapshots: { some: { client_id } } },
        include: {
            snapshots: {
                orderBy: { start_date: "asc" },
                take: 1,
            },
        },
    });
}
