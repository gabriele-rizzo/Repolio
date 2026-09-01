import { AiTextRepair } from "@/components/admin/ai-text-repair";
import {
    CronRunsTable,
    DisconnectedConnectionsTable,
    RecentFailuresTable,
    StaleAccountsTable,
} from "@/components/admin/health-tables";
import { Typo } from "@/components/typography";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CRON_BUDGET_MS } from "@/lib/cron/budget";
import { phaseCounts } from "@/lib/cron/phase-detail";
import { DAY_MS } from "@/lib/constants";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { prisma } from "@/lib/prisma";
import { attempt, failed } from "@/lib/try-catch";
import { HeartPulse, Link2Off } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

export const metadata: Metadata = {
    title: "Health",
};

// The pipeline is best-effort everywhere: one failed client never aborts the others, and a failed AI
// call still leaves a report that renders live KPIs. That makes SILENCE the default failure mode — and
// until this page existed, every durable record of a failure (SyncError, CronRun) was reachable only by
// hand-running SQL against production, which is to say: never, casually.
//
// Three questions, in the order you'd actually ask them:
//   1. Did the scheduled work run, and did it finish?      → CronRun
//   2. Has a client's grant gone dead at the provider?     → PlatformConnection.status
//   3. Is any account's data quietly not advancing?        → AdAccount.last_synced_at
//   4. What actually failed, and where?                    → SyncError
//   5. Is a client still reading a half-derailed narrative? → AiTextRepair
//
// (2) has to be its own question rather than a column on (3), because a dead grant REMOVES its
// accounts from the stale list — that query is scoped to `connection: { status: "CONNECTED" }`, so
// the moment the health check correctly marks a connection dead, everything under it stops being
// reported as stale. Without this section a detected disconnect and a healthy deployment look
// identical from here, which is the opposite of what detecting it was for.

/** Beyond this, an active account's sync is silently failing (the daily cron runs every 24h). */
const STALE_AFTER_MS = 2 * DAY_MS;
const RUN_LIMIT = 12;
const ERROR_LIMIT = 40;

export default async function HealthPage() {
    const [locale, tDate] = await Promise.all([getLocale(), getTranslations("date")]);
    const stamp = (d: Date) => dateFormatRelative(d, { locale, t: tDate });

    // Server component, rendered once per request, so a request-time window is what we want.
    // Same reasoning as components/dashboard/home-overview.tsx.
    // eslint-disable-next-line react-hooks/purity
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS);

    const [runs, disconnected, stale, errors] = await Promise.all([
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
                    // The combined `daily` job's top-level counts are its SNAPSHOT phase only; the
                    // report phase lives in here. Read, not just stored — see lib/cron/phase-detail.ts.
                    detail: true,
                },
            }),
        ),
        // Grants Zernio reports as disconnected, newest mark first. Reconciled by syncConnectionHealth
        // in the daily snapshot run (actions/snapshot/collect-snapshots.ts), which is the only writer.
        attempt(
            prisma.platformConnection.findMany({
                where: { status: "DISCONNECTED" },
                orderBy: [{ updated_at: "desc" }, { id: "asc" }],
                take: 40,
                select: {
                    id: true,
                    platform: true,
                    updated_at: true,
                    client: { select: { name: true, email: true } },
                    _count: { select: { ad_accounts: true } },
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

                <Typo as="muted" className="text-sm">
                    The <code>daily</code> job runs two phases, counted separately: snapshot collection, then
                    report generation. A run finishing is not the same as a run working — the phases fail
                    independently, so read both lines before calling a run healthy.
                </Typo>

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
                    <CronRunsTable
                        rows={runs.data.map(({ detail, ...run }) => ({ ...run, poll: phaseCounts(detail, "poll") }))}
                        stamp={stamp}
                    />
                )}
            </section>

            {/* ── 2. Whose grant is dead at the provider? ────────────────────── */}
            <section className="space-y-3">
                <Typo as="lead">Disconnected connections</Typo>
                <Typo as="muted" className="text-sm">
                    Grants Zernio reports as disconnected — the shape a client changing their platform
                    password leaves behind: the OAuth token is revoked, so Zernio serves nothing and no amount
                    of re-pulling helps until the client reconnects. They are notified automatically, at most
                    once a week. Note these accounts are <em>excluded</em> from the stale list below, so this
                    is the only place they appear.
                </Typo>

                {failed(disconnected) ? (
                    <Card className="p-4">
                        <Typo as="muted" className="text-sm">Could not read connections.</Typo>
                    </Card>
                ) : disconnected.data.length === 0 ? (
                    <Empty className="border border-dashed">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <Link2Off />
                            </EmptyMedia>
                            <EmptyTitle>Every grant is live</EmptyTitle>
                            <EmptyDescription>
                                No connection is marked disconnected. This only reflects what the last daily run
                                saw — a grant that died since then still reads as connected here.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <DisconnectedConnectionsTable rows={disconnected.data} stamp={stamp} />
                )}
            </section>

            {/* ── 3. Whose data stopped advancing? ───────────────────────────── */}
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

            {/* ── 4. What failed? ────────────────────────────────────────────── */}
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

            {/* ── 5. Is a client still reading a half-derailed narrative? ────── */}
            <section className="space-y-3">
                <Typo as="lead">AI text repair</Typo>
                <Typo as="muted" className="text-sm">
                    A model writing under a constrained response format can close the JSON structure inside a
                    field instead of around it, then narrate its own repair — all of it inside prose the client
                    reads. New reports are scrubbed on the way in; this finds the ones written before that and
                    rewrites them. Released reports included: the emailed PDF can&apos;t be recalled, but the
                    report page still renders from these rows, and so does the history the next generation reads.
                </Typo>

                <AiTextRepair />
            </section>
        </div>
    );
}
