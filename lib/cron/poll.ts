import { collectSnapshots } from "@/actions/snapshot/collect-snapshots";
import type { Client, Snapshot } from "@/generated/prisma/browser";
import { getAnthropic } from "@/lib/ai/anthropic";
import { buildReportParams } from "@/lib/ai/generate-report";
import { startOfUtcDay } from "@/lib/date/start-of-day";
import { computeMetrics } from "@/lib/metrics/compute";
import { prisma } from "@/lib/prisma";
import { notifyReportReady } from "@/lib/report/notify";
import { logSyncError } from "@/lib/sync-error";
import { createAdminClient } from "@/lib/supabase/admin/server";
import pLimit from "p-limit";

// Submit phase of report generation for clients whose recurrence is due. Snapshots are collected
// daily by runSnapshots; this back-fills any due client missing today's snapshots, creates one
// report per ad account for the period, and submits the AI section to the Anthropic Batches API
// (50% cheaper than live calls). The collect cron writes the results back and notifies.
//
// Zero-activity accounts (no spend and no impressions this period) get a report row too — the KPIs
// render live on the report page regardless — but skip the AI call entirely: the report is created
// empty and the client is notified immediately here, so we never pay tokens narrating "nothing
// happened".
//
// Extracted from the route so it can run both standalone (/api/cron/poll) and as the second phase
// of the combined /api/cron/daily job.

const limit = pLimit(10);

export async function runPoll(): Promise<{ status: number; error: string | null }> {
    const supabase = await createAdminClient();
    const dresponse = await supabase.rpc("due_clients");

    if (dresponse.error) {
        console.error("Failed to get due users:", dresponse.error);
        return { status: 500, error: "Failed to get due clients" };
    }

    const dueClients = dresponse.data as Client[];
    if (dueClients.length === 0) return { status: 204, error: null };

    // Self-heal: ensure every due client has today's snapshots. The daily snapshot phase normally
    // handles this; if it missed or failed for a client, collect now so the report isn't stale.
    // collectSnapshots is idempotent (per-day upsert), so a redundant call here is harmless.
    const today = startOfUtcDay(new Date());
    await Promise.all(
        dueClients.map((c) =>
            limit(async () => {
                const fresh = await prisma.snapshot.findFirst({
                    where: { ad_account: { connection: { client_id: c.id } }, start_date: { gte: today } },
                    select: { id: true },
                });
                if (fresh) return;

                try {
                    const result = await collectSnapshots(c);
                    if (result.error) console.error(`Snapshot back-fill failed for client ${c.id}: ${result.error}`);
                } catch (error) {
                    // Thrown (non-Result) path — the Result path already records at its source.
                    console.error(`Snapshot back-fill threw for client ${c.id}:`, error);
                    await logSyncError({ stage: "poll_backfill", clientId: c.id, message: String(error) });
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

                    // Group the report's period by snapshot start_date (the metric day), not
                    // created_at: daily rows are upserted and re-fetched, so created_at no longer
                    // tracks the period. start_date matches how getReport derives the window.
                    // Complete days only: the run stores a near-empty row for the just-started UTC
                    // day, which would read as a fake collapse in the report KPIs and AI narrative
                    // — reports end on the last full day (the dashboard still shows live today).
                    const since = startOfUtcDay(new Date(last?.created_at ?? c.created_at));
                    return prisma.snapshot.findMany({
                        where: {
                            ad_account: { connection: { client_id: c.id } },
                            start_date: { gt: since, lt: today },
                        },
                    });
                }),
            ),
        )
    ).flat();

    if (periodSnapshots.length === 0) return { status: 204, error: null };

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

    // One report per ad account. Zero-activity accounts are finished here (empty + notified); the
    // rest produce a batch request keyed by report id so the collect cron can match results back.
    type BatchRequest = { custom_id: string; params: Awaited<ReturnType<typeof buildReportParams>> };
    const pending = await Promise.all(
        groupEntries.map(([adAccountId, group]) =>
            limit(async (): Promise<{ reportId: number; request: BatchRequest } | null> => {
                const report = await prisma.report.create({
                    data: {
                        executive_summary: "",
                        recommendations: [],
                        trend_explanation: "",
                        snapshots: { connect: group.map((s) => ({ id: s.id })) },
                    },
                });

                const account = accounts.get(adAccountId);
                const client = account ? clientsById.get(account.connection.client_id) : undefined;

                const metrics = computeMetrics(group);
                // Conversions guard is defensive: Meta attributes actions to impression/click days,
                // so conversions without impressions are near-impossible — but never mute a period
                // that did convert.
                const zeroActivity =
                    !metrics || (metrics.spend === 0 && metrics.impressions === 0 && metrics.conversions === 0);

                if (zeroActivity) {
                    // Empty report, no AI call. Notify now — there's nothing to wait for.
                    if (account && client) {
                        await notifyReportReady({
                            reportId: report.id,
                            adAccountId,
                            adAccountName: account.name,
                            client,
                        });
                    }
                    return null;
                }

                try {
                    const params = await buildReportParams(report.id);
                    return { reportId: report.id, request: { custom_id: String(report.id), params } };
                } catch (error) {
                    // Leave the report empty (KPIs still render); log and move on.
                    console.error(`Failed to build report params for report ${report.id}:`, error);
                    return null;
                }
            }),
        ),
    );

    const active = pending.filter((p): p is { reportId: number; request: BatchRequest } => p !== null);
    if (active.length === 0) return { status: 200, error: null };

    // Submit all AI sections as a single batch, then mark those reports pending so the collect cron
    // picks them up. On submit failure the reports simply stay empty (ai_pending stays false) — no
    // orphaned "forever pending" rows.
    try {
        const batch = await getAnthropic().messages.batches.create({
            requests: active.map((a) => a.request),
        });
        await prisma.report.updateMany({
            where: { id: { in: active.map((a) => a.reportId) } },
            data: { ai_pending: true, batch_id: batch.id },
        });
    } catch (error) {
        console.error("Failed to submit report batch:", error);
        await logSyncError({ stage: "batch_submit", message: String(error) });
        return { status: 500, error: "Failed to submit report batch" };
    }

    return { status: 200, error: null };
}
