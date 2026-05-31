"use server";

import type { AdAccount, PlatformConnection } from "@/generated/prisma/browser";
import type { SnapshotCreateManyInput } from "@/generated/prisma/models";
import { mockMetaSnapshot } from "@/lib/data/mock-meta-snapshot";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/try-catch";

type SnapshotFetchResult = Result<SnapshotCreateManyInput, string>;
export type AdAccountWithConnection = AdAccount & { connection: PlatformConnection };

export async function fetchSnapshot(adAccount: AdAccountWithConnection): Promise<SnapshotFetchResult> {
    const { platform } = adAccount.connection;

    if (platform === "META") {
        const last = await prisma.snapshot.findFirst({
            where: { platform: "META", ad_account_id: adAccount.id },
            orderBy: { created_at: "desc" },
        });

        const start_date = last?.created_at ?? adAccount.created_at;
        const data = mockMetaSnapshot(start_date);

        return ok({ data, ad_account_id: adAccount.id, start_date, platform: "META" });

        // TODO: use real api point
    }

    // TODO: implement
    return err(`Fetching snapshot for unimplemented platform '${platform}'`);
}
