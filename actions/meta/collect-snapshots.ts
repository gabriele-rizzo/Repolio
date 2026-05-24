"use server";

import { type Client, type Snapshot } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { err, ok, sink } from "@/lib/try-catch";
import { fetchSnapshot } from "./fetch-snapshot";

export async function collectSnapshots(client: Client): Promise<Result<Snapshot[], string>> {
    const now = new Date();
    const raw = await prisma.accountConnection.findMany({
        where: { client_id: client.id },
    });

    const connections = raw.filter((c) => (c.expires_at ? new Date(c.expires_at) > now : true));
    const results = await Promise.all(connections.map((c) => fetchSnapshot(client, c)));
    const [data, errors] = sink(results);

    if (errors.length > 0) {
        errors.forEach((e) => console.error(`Snapshot fetch failed: ${e}`));

        if (data.length === 0) {
            return err(`No successful snapshot fetch for client '${client.id}', but there were errors (check logs).`);
        }
    }

    try {
        const snapshots = await prisma.snapshot.createManyAndReturn({ data, skipDuplicates: true });
        return ok(snapshots);
    } catch {
        return err(`Failed to insert snapshots for client '${client.id}'`);
    }
}
