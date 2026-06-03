import { collectSnapshots } from "@/actions/snapshot/collect-snapshots";
import type { Client, Snapshot } from "@/generated/prisma/browser";
import { generateReportContent } from "@/lib/ai/generate-report";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { startOfDay } from "@/lib/date/start-of-day";
import { renderReportEmail } from "@/lib/email/render-report";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin/server";
import { err } from "@/lib/try-catch";
import { NextResponse, type NextRequest } from "next/server";
import pLimit from "p-limit";

// Generates reports for clients whose recurrence is due. Snapshots are collected daily by
// /api/cron/snapshots; this route only back-fills any due client missing today's snapshots, then
// reports. Split from collection so report generation gets its own execution-time budget.

const limit = pLimit(10);

export async function POST(request: NextRequest): Promise<ResultResponse<null, string>> {
    if (!isAuthorizedCron(request)) return NextResponse.json(err("Unauthorized"), { status: 401 });

    const supabase = await createAdminClient();
    const dresponse = await supabase.rpc("due_clients");

    if (dresponse.error) {
        console.error("Failed to get due users:", dresponse.error);
        return new NextResponse(null, { status: 500 });
    }

    const dueClients = dresponse.data as Client[];
    if (dueClients.length === 0) return new NextResponse(null, { status: 204 });

    // Self-heal: ensure every due client has today's snapshots. The daily snapshot cron normally
    // handles this; if it missed or failed for a client, collect now so the report isn't stale.
    // collectSnapshots is idempotent (skipDuplicates), so a redundant call here is harmless.
    const today = startOfDay(new Date());
    await Promise.all(
        dueClients.map((c) =>
            limit(async () => {
                const fresh = await prisma.snapshot.findFirst({
                    where: { ad_account: { connection: { client_id: c.id } }, created_at: { gte: today } },
                    select: { id: true },
                });
                if (fresh) return;

                try {
                    const result = await collectSnapshots(c);
                    if (result.error) console.error(`Snapshot back-fill failed for client ${c.id}: ${result.error}`);
                } catch (error) {
                    console.error(`Snapshot back-fill threw for client ${c.id}:`, error);
                }
            }),
        ),
    );

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

    // client_id -> Client, for the report email recipient. Due clients own all these accounts.
    const clientsById = new Map(dueClients.map((c) => [c.id, c]));

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

                // Fill in the AI section from the account's recent history. A
                // generation failure must not fail the report — KPIs still
                // render live on the report page, just without the narrative.
                try {
                    await generateReportContent(report.id);
                } catch (error) {
                    console.error(`Failed to generate AI content for report ${report.id}:`, error);
                }

                // Notify the client in-app and by email. Neither delivery failure should fail the report.
                const account = accounts.get(adAccountId);
                if (account) {
                    const clientId = account.connection.client_id;

                    try {
                        await prisma.notification.create({
                            data: {
                                client_id: clientId,
                                type: "REPORT_READY",
                                title: `New report for ${account.name ?? "an ad account"}`,
                                body: "Your latest performance report is ready to view.",
                                link: `/dashboard/reports/${report.id}?account=${adAccountId}`,
                            },
                        });
                    } catch (error) {
                        console.error("Failed to create notification:", error);
                    }

                    const client = clientsById.get(clientId);
                    if (client) {
                        try {
                            const email = await renderReportEmail(report.id, clientId);
                            if (email) {
                                // Lazy import so a missing/invalid RESEND_API_KEY can't crash report
                                // generation — it just fails the email below and is logged.
                                const { resend } = await import("@/lib/resend");
                                const { error } = await resend.emails.send({
                                    // Set RESEND_FROM to a verified-domain sender in production; the
                                    // resend.dev fallback only delivers to the Resend account owner.
                                    from: process.env.RESEND_FROM ?? "Repolio <team@gj-automate.com>",
                                    to: client.email,
                                    subject: email.subject,
                                    html: email.html,
                                });

                                if (error) console.error(`Resend rejected report email ${report.id}:`, error);
                            }
                        } catch (error) {
                            console.error(`Failed to send report email for report ${report.id}:`, error);
                        }
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
