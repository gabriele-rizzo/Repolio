import { metaAdapter } from "@/actions/adapters/meta";
import { collectSnapshots } from "@/actions/meta/collect-snapshots";
import type { Client, Platform, Snapshot } from "@/generated/prisma/browser";
import { startOfDay } from "@/lib/date/start-of-day";
import { checkEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin/server";
import { err, settle } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";
import pLimit from "p-limit";

const limit = pLimit(10);

const ADAPTERS: Record<Platform, Repolio.Adapter> = {
    META: metaAdapter,
};

export async function POST(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (process.env.NODE_ENV !== "development") {
        const header = request.headers.get("authorization");
        const secret = checkEnv("CRON_SECRET");

        if (secret && header !== `bearer ${secret}`) {
            return NextResponse.json(err("Unauthorized"), { status: 401 });
        }
    }

    const clients = await prisma.client.findMany({ where: { active: true } });

    const sresponse = settle("snapshots", await Promise.all(clients.map((c) => limit(() => collectSnapshots(c)))));
    if (sresponse.error) return NextResponse.json(err(sresponse.error), { status: 500 });

    const snapshots = sresponse.data?.flat();
    if (!snapshots || snapshots.length === 0) return new NextResponse(null, { status: 204 });

    const supabase = await createAdminClient();
    const dresponse = await supabase.rpc("due_clients");

    if (dresponse.error) {
        console.error("Failed to get due users:", dresponse.error);
        return new NextResponse(null, { status: 500 });
    }

    const dueClients = dresponse.data as Client[];
    if (dueClients.length === 0) return new NextResponse(null, { status: 204 });

    const periodSnapshots = (
        await Promise.all(
            dueClients.map((c) =>
                limit(async () => {
                    const last = await prisma.report.findFirst({
                        where: { snapshots: { some: { ad_account: { connection: { client_id: c.id } } } } },
                        orderBy: { created_at: "desc" },
                        select: { created_at: true },
                    });

                    const since = startOfDay(new Date(last?.created_at ?? c.created_at));
                    return prisma.snapshot.findMany({
                        where: {
                            ad_account: { connection: { client_id: c.id } },
                            created_at: { gt: since.toISOString() },
                        },
                    });
                }),
            ),
        )
    ).flat();

    if (periodSnapshots.length === 0) return new NextResponse(null, { status: 204 });

    const groups = new Map<number, Snapshot[]>();
    for (const s of periodSnapshots) {
        const bucket = groups.get(s.ad_account_id);
        if (bucket) bucket.push(s);
        else groups.set(s.ad_account_id, [s]);
    }

    const built = await Promise.all(
        Array.from(groups.values()).map((group) =>
            limit(async () => {
                const result = await ADAPTERS[group[0].platform](group);
                return { group, result };
            }),
        ),
    );

    const rresponse = settle(
        "reports",
        built.map((b) => b.result),
    );
    if (rresponse.error) return NextResponse.json(err(rresponse.error), { status: 500 });

    const successful = built.flatMap(({ group, result }) => (result.data ? [{ group, data: result.data }] : []));

    try {
        await prisma.$transaction(
            successful.map(({ group, data }) =>
                prisma.report.create({
                    data: { ...data, snapshots: { connect: group.map((s) => ({ id: s.id })) } },
                }),
            ),
        );
        return new NextResponse(null);
    } catch (error) {
        console.error(`Failed to insert ${successful.length} reports:`, error);
        return new NextResponse(null, { status: 500 });
    }
}
