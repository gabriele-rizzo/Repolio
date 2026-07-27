/**
 * ONE-OFF ADMIN TEST HARNESS — not part of the app, lives in scratchpad only.
 *
 * Generates a real report for a single ad account WITHOUT notifying the client
 * (no Notification row, no Resend email), then lets you delete it and restore state.
 *
 * Safety invariants:
 *  1. Only ever attaches snapshots whose report_id IS NULL. Snapshot.report_id is a single FK, so
 *     re-attaching an already-reported snapshot would STEAL it from a real report and corrupt it.
 *  2. Never calls notifyReportReady (unlike lib/cron/poll.ts and app/api/cron/collect/route.ts).
 *  3. Uses the live Messages API via generateReportContent, not the 24h batch path.
 *  4. `delete` nulls the snapshots' report_id before deleting, fully restoring pre-run state.
 *
 * Usage:
 *   pnpm dlx tsx scratch/test-report.ts list
 *   pnpm dlx tsx scratch/test-report.ts generate <adAccountId> --yes
 *   pnpm dlx tsx scratch/test-report.ts delete <reportId> --yes
 */

import { config } from "dotenv";
import { resolve } from "path";

// A standalone script gets none of Next's env loading.
config({ path: resolve(process.cwd(), ".env.local") });

const startOfUtcDay = (d: Date): Date =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const fmt = (d: Date | string | null): string => (d ? new Date(d).toISOString().slice(0, 10) : "—");

async function main() {
    // Imported lazily so dotenv runs before lib/env.ts's checkEnv sees process.env.
    const { prisma } = await import("@/lib/prisma");
    const { computeMetrics } = await import("@/lib/metrics/compute");

    const [mode, arg] = process.argv.slice(2);
    const confirmed = process.argv.includes("--yes");

    if (mode === "list") {
        // READ-ONLY. Ranks accounts by the report-worthy period that is currently UNREPORTED
        // (report_id IS NULL) — i.e. exactly what a new report would cover — plus 30d context.
        const rows = await prisma.$queryRaw<
            Array<{
                client_id: number;
                client: string;
                company: string | null;
                platform: string;
                ad_account_id: number;
                ad_account: string | null;
                currency: string | null;
                pending_days: bigint;
                pending_from: Date | null;
                pending_to: Date | null;
                pending_spend: number | null;
                pending_impressions: bigint | null;
                existing_reports: bigint;
                last_synced_at: Date | null;
            }>
        >`
            SELECT c.id AS client_id,
                   c.name AS client,
                   c.company,
                   pc.platform::text AS platform,
                   a.id AS ad_account_id,
                   a.name AS ad_account,
                   a.currency,
                   COUNT(s.id) AS pending_days,
                   MIN(s.start_date) AS pending_from,
                   MAX(s.start_date) AS pending_to,
                   ROUND(SUM(COALESCE((s.data->>'spend')::numeric, 0)), 2)::float8 AS pending_spend,
                   SUM(COALESCE((s.data->>'impressions')::numeric, 0))::bigint AS pending_impressions,
                   (SELECT COUNT(DISTINCT r.id) FROM "Snapshot" rs
                      JOIN "Report" r ON r.id = rs.report_id
                     WHERE rs.ad_account_id = a.id) AS existing_reports,
                   a.last_synced_at
              FROM "AdAccount" a
              JOIN "PlatformConnection" pc ON pc.id = a.connection_id
              JOIN "Client" c ON c.id = pc.client_id
              LEFT JOIN "Snapshot" s
                     ON s.ad_account_id = a.id
                    AND s.report_id IS NULL
                    AND s.start_date < date_trunc('day', now() AT TIME ZONE 'UTC')
             GROUP BY c.id, c.name, c.company, pc.platform, a.id, a.name, a.currency, a.last_synced_at
             ORDER BY pending_spend DESC NULLS LAST, pending_impressions DESC NULLS LAST
             LIMIT 20;
        `;

        console.log("\nMost influential accounts by UNREPORTED period (what a new report would cover)\n");
        for (const r of rows) {
            console.log(
                [
                    `acct ${String(r.ad_account_id).padStart(4)}`,
                    `${(r.ad_account ?? "(unnamed)").slice(0, 26).padEnd(26)}`,
                    `${r.platform.padEnd(9)}`,
                    `client ${String(r.client_id).padStart(3)} ${(r.company ?? r.client).slice(0, 20).padEnd(20)}`,
                    `pending ${String(r.pending_days).padStart(3)}d ${fmt(r.pending_from)}→${fmt(r.pending_to)}`,
                    `spend ${String(r.pending_spend ?? 0).padStart(10)} ${r.currency ?? ""}`,
                    `impr ${String(r.pending_impressions ?? 0).padStart(9)}`,
                    `reports ${String(r.existing_reports).padStart(3)}`,
                    `synced ${fmt(r.last_synced_at)}`,
                ].join("  "),
            );
        }
        console.log("\nNo writes performed.\n");
        return;
    }

    if (mode === "generate") {
        const adAccountId = Number(arg);
        if (!Number.isInteger(adAccountId)) throw new Error("generate needs a numeric <adAccountId>");

        const account = await prisma.adAccount.findUnique({
            where: { id: adAccountId },
            select: {
                id: true,
                name: true,
                currency: true,
                connection: { select: { platform: true, client: { select: { id: true, name: true, email: true } } } },
            },
        });
        if (!account) throw new Error(`Ad account ${adAccountId} not found`);

        const today = startOfUtcDay(new Date());
        // report_id IS NULL is the load-bearing guard — see invariant 1 above.
        const snapshots = await prisma.snapshot.findMany({
            where: { ad_account_id: adAccountId, report_id: null, start_date: { lt: today } },
            orderBy: { start_date: "asc" },
        });

        if (snapshots.length === 0) {
            console.log(`\nNothing to report: account ${adAccountId} has no unreported complete days.`);
            console.log("Every snapshot is already attached to a report. Aborting (attaching them would corrupt it).\n");
            return;
        }

        const metrics = computeMetrics(snapshots);
        const zeroActivity =
            !metrics || (metrics.spend === 0 && metrics.impressions === 0 && metrics.conversions === 0);

        console.log(`\nAccount     : ${account.name ?? "(unnamed)"} (id ${account.id}, ${account.connection.platform})`);
        console.log(`Client      : ${account.connection.client.name} (id ${account.connection.client.id})`);
        console.log(`Client email: ${account.connection.client.email}  <-- will NOT be emailed`);
        console.log(`Period      : ${fmt(snapshots[0].start_date)} → ${fmt(snapshots.at(-1)!.start_date)} (${snapshots.length} days)`);
        console.log(
            `Metrics     : spend ${metrics?.spend ?? 0} ${metrics?.currency ?? ""}, ${metrics?.impressions ?? 0} impr, ` +
                `${metrics?.conversions ?? 0} conv, score ${metrics?.performance_score ?? "—"} (${metrics?.score_label ?? "—"})`,
        );
        if (zeroActivity) console.log("WARNING: zero-activity period — the real pipeline would create an EMPTY report here.");

        if (!confirmed) {
            console.log("\nDry run. Re-run with --yes to create the report.\n");
            return;
        }

        const report = await prisma.report.create({
            data: {
                executive_summary: "",
                recommendations: [],
                trend_explanation: "",
                snapshots: { connect: snapshots.map((s) => ({ id: s.id })) },
            },
        });
        console.log(`\nCreated report ${report.id} (snapshots attached).`);

        if (!zeroActivity) {
            console.log("Calling Claude live (no batch, no notify)...");
            const { generateReportContent } = await import("@/lib/ai/generate-report");
            await generateReportContent(report.id);
            console.log("AI section written.");
        }

        console.log(`\n  Admin preview : /admin/simulation?client=${account.connection.client.id}&account=${account.id}`);
        console.log(`  Raw report    : /dashboard/reports/${report.id}?account=${account.id}  (client-visible path!)`);
        console.log(`\n  TEAR DOWN WHEN DONE:`);
        console.log(`  pnpm dlx tsx scratch/test-report.ts delete ${report.id} --yes\n`);
        return;
    }

    if (mode === "delete") {
        const reportId = Number(arg);
        if (!Number.isInteger(reportId)) throw new Error("delete needs a numeric <reportId>");

        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: { snapshots: { select: { id: true, start_date: true } } },
        });
        if (!report) throw new Error(`Report ${reportId} not found`);

        console.log(`\nReport ${reportId} created ${report.created_at.toISOString()}`);
        console.log(`Attached snapshots: ${report.snapshots.length} (will be detached, NOT deleted)`);

        if (!confirmed) {
            console.log("\nDry run. Re-run with --yes to delete.\n");
            return;
        }

        // Detach explicitly rather than relying on the implicit SetNull, so the restore is obvious.
        const detached = await prisma.snapshot.updateMany({
            where: { report_id: reportId },
            data: { report_id: null },
        });
        await prisma.report.delete({ where: { id: reportId } });

        console.log(`\nDetached ${detached.count} snapshots, deleted report ${reportId}. State restored.\n`);
        return;
    }

    console.log("Usage: list | generate <adAccountId> [--yes] | delete <reportId> [--yes]");
}

main()
    .catch((e) => {
        console.error("\nFAILED:", e instanceof Error ? e.message : e);
        process.exit(1);
    })
    .then(async () => {
        const { prisma } = await import("@/lib/prisma");
        await prisma.$disconnect();
    });
