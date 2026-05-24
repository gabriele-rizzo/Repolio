"use server";

import type { AccountConnection, Client } from "@/generated/prisma/browser";
import type { SnapshotCreateManyInput } from "@/generated/prisma/models";
import { mockMetaSnapshot } from "@/lib/data/mock-meta-snapshot";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/try-catch";

type SnapshotFetchResult = Result<SnapshotCreateManyInput, string>;

export async function fetchSnapshot(client: Client, connection: AccountConnection): Promise<SnapshotFetchResult> {
    if (connection.platform === "META") {
        const last = await prisma.snapshot.findFirst({
            where: { platform: "META", client_id: client.id },
            orderBy: { created_at: "desc" },
        });

        const start_date = last?.created_at ?? client.created_at;
        const data = mockMetaSnapshot(start_date);

        return ok({ data, client_id: client.id, start_date, platform: "META" });

        // TODO: use real api point
    }

    // TODO: implement
    return err(`Fetching snapshot for unimplemented platform '${connection.platform}'`);
}
