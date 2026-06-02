import { collectSnapshots } from "@/actions/snapshot/collect-snapshots";
import type { Client, Snapshot } from "@/generated/prisma/browser";
import { startOfDay } from "@/lib/date/start-of-day";
import { checkEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin/server";
import { err, settle } from "@/lib/try-catch";
import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import pLimit from "p-limit";

const limit = pLimit(10);

export async function POST(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (process.env.NODE_ENV !== "development") {
        // checkEnv throws if CRON_SECRET is unset, so a misconfigured deployment
        // fails closed rather than leaving the endpoint open.
        const expected = Buffer.from(`Bearer ${checkEnv("CRON_SECRET")}`);
        const provided = Buffer.from(request.headers.get("authorization") ?? "");

        if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
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

    const groupEntries = Array.from(groups.entries());

    // Resolve the owning client + display name for each ad account so we can notify.
    const adAccountIds = groupEntries.map(([id]) => id);
    const adAccounts = await prisma.adAccount.findMany({
        where: { id: { in: adAccountIds } },
        select: { id: true, name: true, connection: { select: { client_id: true } } },
    });
    const accounts = new Map(adAccounts.map((a) => [a.id, a]));

    // One report per ad account for this period. Reports only carry AI output
    // (empty until the AI step runs); KPIs are computed live on the report page.
    const inserts = await Promise.allSettled(
        groupEntries.map(([adAccountId, group]) =>
            limit(async () => {
                const report = await prisma.report.create({
                    data: {
                        executive_summary: "",
                        recommendations: [],
                        trend_explanation: "",
                        snapshots: { connect: group.map((s) => ({ id: s.id })) },
                    },
                });

                // Notify the client; a notification failure must not fail the report.
                const account = accounts.get(adAccountId);
                if (account) {
                    try {
                        await prisma.notification.create({
                            data: {
                                client_id: account.connection.client_id,
                                type: "REPORT_READY",
                                title: `New report for ${account.name ?? "an ad account"}`,
                                body: "Your latest performance report is ready to view.",
                                link: `/dashboard/reports/${report.id}`,
                            },
                        });
                    } catch (error) {
                        console.error("Failed to create notification:", error);
                    }
                }

                return report;
            }),
        ),
    );

    const failures = inserts.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
        failures.forEach((f) => console.error("Failed to insert report:", (f as PromiseRejectedResult).reason));
        if (failures.length === inserts.length) {
            return NextResponse.json(err("Failed to insert reports"), { status: 500 });
        }
    }

    return new NextResponse(null);
}
