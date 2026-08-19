import { CronRunsTable, RecentFailuresTable, StaleAccountsTable } from "@/components/admin/health-tables";
import { Typo } from "@/components/typography";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CRON_BUDGET_MS } from "@/lib/cron/budget";
import { DAY_MS } from "@/lib/constants";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { prisma } from "@/lib/prisma";
import { HeartPulse } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

export const metadata: Metadata = {
    title: "Health | Repolio",
};

// The pipeline is best-effort everywhere: one failed client never aborts the others, and a failed AI
// call still leaves a report that renders live KPIs. That makes SILENCE the default failure mode — and
// until this page existed, every durable record of a failure (SyncError, CronRun) was reachable only by
// hand-running SQL against production, which is to say: never, casually.
//
// Three questions, in the order you'd actually ask them:
//   1. Did the scheduled work run, and did it finish?      → CronRun
//   2. Is any account's data quietly not advancing?        → AdAccount.last_synced_at
//   3. What actually failed, and where?                    → SyncError

/** Beyond this, an active account's sync is silently failing (the daily cron runs every 24h). */
const STALE_AFTER_MS = 2 * DAY_MS;
const RUN_LIMIT = 12;
const ERROR_LIMIT = 40;

/**
 * Both tables are observability-only, and `CronRun` may not exist yet on a deployment where its
 * migration has not been applied. Same contract as the writers in lib/sync-error.ts and
 * lib/cron/run-record.ts: degrade to a note rather than 500 the page an operator opens to find out what
 * is wrong.
 */
async function attempt<T>(query: Promise<T>): Promise<{ data: T; error: null } | { data: null; error: string }> {
    try {
        return { data: await query, error: null };
    } catch (error) {
        return { data: null, error: String(error) };
    }
}

/**
 * Narrow on `data`, not on `error`.
 *
 * `error: string` includes `""`, which is falsy, so `if (result.error)` does not discriminate this union
 * for the type checker — the falsy branch could still be the failure member. Testing `data === null` does.
 */
const failed = <T,>(r: { data: T; error: null } | { data: null; error: string }): r is { data: null; error: string } =>
    r.data === null;

export default async function HealthPage() {
    const [locale, tDate] = await Promise.all([getLocale(), getTranslations("date")]);
    const stamp = (d: Date) => dateFormatRelative(d, { locale, t: tDate });

    // Server component, rendered once per request, so a request-time window is what we want.
    // Same reasoning as components/dashboard/home-overview.tsx.
    // eslint-disable-next-line react-hooks/purity
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS);

    const [runs, stale, errors] = await Promise.all([
        attempt(
            prisma.cronRun.findMany({
                orderBy: { started_at: "desc" },
                take: RUN_LIMIT,
                select: {
                    id: true,
                    job: true,
                    started_at: true,
                    finished_at: true,
                    duration_ms: true,
                    considered: true,
                    processed: true,
                    failed: true,
                    skipped: true,
                },
            }),
        ),
        // Active accounts on a live connection whose last successful sync is missing or stale. Grouped in
        // one query rather than one per account — see the query-shape note in CLAUDE.md.
        attempt(
            prisma.adAccount.findMany({
                where: {
                    active: true,
                    connection: { status: "CONNECTED" },
                    OR: [{ last_synced_at: null }, { last_synced_at: { lt: staleBefore } }],
                },
                orderBy: [{ last_synced_at: { sort: "asc", nulls: "first" } }, { id: "asc" }],
                take: 40,
                select: {
                    id: true,
                    name: true,
                    external_id: true,
                    last_synced_at: true,
                    connection: { select: { platform: true, client: { select: { name: true, email: true } } } },
                },
            }),
        ),
        attempt(
            prisma.syncError.findMany({
                orderBy: { created_at: "desc" },
                take: ERROR_LIMIT,
                select: { id: true, created_at: true, stage: true, message: true, client_id: true, ad_account_id: true },
            }),
        ),
    ]);

    const lastDaily = runs.data?.find((r) => r.job === "daily");

    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <Typo as="title">Health</Typo>
                <Typo as="muted" className="max-w-3xl">
                    Whether the scheduled work ran, whose data has stopped advancing, and what failed. Every
                    stage here is best-effort by design, so nothing on this page raises an alarm on its own —
                    that is what makes looking at it worthwhile.
                </Typo>
            </div>

            {/* ── 1. Did it run? ─────────────────────────────────────────────── */}
            <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Typo as="lead">Recent cron runs</Typo>
                    {lastDaily && (
                        <Typo as="muted" className="text-xs">
                            Budget {Math.round(CRON_BUDGET_MS / 1000)}s · last daily run{" "}
                            {lastDaily.duration_ms == null ? "did not finish" : `took ${(lastDaily.duration_ms / 1000).toFixed(1)}s`}
                        </Typo>
                    )}
                </div>

                {failed(runs) ? (
                    <Card className="p-4">
                        <Typo as="muted" className="text-sm">
                            No run history — the <code>CronRun</code> table is not there yet. Apply
                            <code> prisma/migrations/20260819120000_cron_run</code> and runs will start recording.
                        </Typo>
                    </Card>
                ) : runs.data.length === 0 ? (
                    <Card className="p-4">
                        <Typo as="muted" className="text-sm">No runs recorded yet.</Typo>
                    </Card>
                ) : (
                    <CronRunsTable rows={runs.data} stamp={stamp} />
                )}
            </section>

            {/* ── 2. Whose data stopped advancing? ───────────────────────────── */}
            <section className="space-y-3">
                <Typo as="lead">Stale ad accounts</Typo>
                <Typo as="muted" className="text-sm">
                    Active accounts on a connected platform with no successful sync in the last 48 hours. The
                    daily cron runs every 24, so anything here has missed at least one round.
                </Typo>

                {failed(stale) ? (
                    <Card className="p-4">
                        <Typo as="muted" className="text-sm">Could not read ad accounts.</Typo>
                    </Card>
                ) : stale.data.length === 0 ? (
                    <Empty className="border border-dashed">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <HeartPulse />
                            </EmptyMedia>
                            <EmptyTitle>Every account is current</EmptyTitle>
                            <EmptyDescription>No active account has gone 48 hours without a sync.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <StaleAccountsTable rows={stale.data} stamp={stamp} />
                )}
            </section>

            {/* ── 3. What failed? ────────────────────────────────────────────── */}
            <section className="space-y-3">
                <Typo as="lead">Recent failures</Typo>
                <Typo as="muted" className="text-sm">
                    Newest first, 30-day retention. Recorded at the point of failure across snapshots, report
                    generation, the AI batches and delivery.
                </Typo>

                {failed(errors) ? (
                    <Card className="p-4">
                        <Typo as="muted" className="text-sm">
                            No failure history — the <code>SyncError</code> table is not there yet.
                        </Typo>
                    </Card>
                ) : errors.data.length === 0 ? (
                    <Empty className="border border-dashed">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <HeartPulse />
                            </EmptyMedia>
                            <EmptyTitle>Nothing recorded</EmptyTitle>
                            <EmptyDescription>No failures in the retention window.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <RecentFailuresTable rows={errors.data} stamp={stamp} />
                )}
            </section>
        </div>
    );
}
