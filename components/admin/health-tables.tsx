import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PhaseCounts } from "@/lib/cron/run-record";

// Presentation for /admin/health. Split from the page so the page owns the queries and these own the
// markup — and so the populated tables can be rendered with synthetic rows, which is otherwise
// impossible: on a healthy deployment every one of these is empty, so the row markup would ship having
// never rendered once.

export interface CronRunRow {
    id: number;
    job: string;
    started_at: Date;
    finished_at: Date | null;
    duration_ms: number | null;
    considered: number;
    processed: number;
    failed: number;
    skipped: number;
    /**
     * The report phase of the combined `daily` job, lifted out of `CronRun.detail` by
     * `phaseCounts` (lib/cron/phase-detail.ts). Null for the standalone `snapshots`/`poll` jobs —
     * and for any row whose detail could not be read — where the top-level counts already describe
     * the whole run.
     */
    poll?: PhaseCounts | null;
}

export interface StaleAccountRow {
    id: number;
    name: string | null;
    external_id: string;
    last_synced_at: Date | null;
    connection: { platform: string; client: { name: string; email: string } };
}

export interface DisconnectedConnectionRow {
    id: number;
    platform: string;
    updated_at: Date;
    client: { name: string; email: string };
    _count: { ad_accounts: number };
}

export interface FailureRow {
    id: number;
    created_at: Date;
    stage: string;
    message: string;
    client_id: number | null;
    ad_account_id: number | null;
}

const seconds = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);

export function CronRunsTable({ rows, stamp }: { rows: CronRunRow[]; stamp: (d: Date) => string }) {
    return (
        <Card className="overflow-x-auto p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead className="text-right">Took</TableHead>
                        <TableHead className="text-right">Processed</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((run) => {
                        // A run's failures can live in either phase, and for the combined `daily` job the
                        // top-level counts cover ONLY the snapshot one. Reading the top level alone is what
                        // let 2026-09-01 render as "ok" while every report narrative that day came back
                        // empty (see lib/cron/phase-detail.ts), so both are folded in here.
                        const reports = run.poll;
                        const reportsFailed = reports?.failed ?? 0;

                        // Named per phase only when there IS a second phase to tell it apart from.
                        const snapshotsLabel = reports
                            ? `${run.failed} snapshot${run.failed === 1 ? "" : "s"} failed`
                            : `${run.failed} failed`;

                        return (
                            <TableRow key={run.id}>
                                <TableCell className="font-mono text-xs">{run.job}</TableCell>
                                <TableCell className="whitespace-nowrap text-sm">{stamp(run.started_at)}</TableCell>
                                <TableCell>
                                    {/* finished_at is stamped on a normal return. Null means the invocation never
                                        reached the end — killed at maxDuration, or the process died. A kill throws
                                        nothing and logs nothing, so this is its only trace. Checked FIRST because a
                                        killed run's counts were never written and would read as a clean zero. */}
                                    {run.finished_at == null ? (
                                        <Badge variant="destructive">never finished</Badge>
                                    ) : run.failed > 0 || reportsFailed > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {run.failed > 0 && (
                                                <Badge variant="destructive">{snapshotsLabel}</Badge>
                                            )}
                                            {reportsFailed > 0 && (
                                                <Badge variant="destructive">
                                                    {`${reportsFailed} report${reportsFailed === 1 ? "" : "s"} failed`}
                                                </Badge>
                                            )}
                                        </div>
                                    ) : run.skipped > 0 ? (
                                        <Badge variant="secondary">deferred {run.skipped}</Badge>
                                    ) : (
                                        <Badge variant="outline">ok</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                    {seconds(run.duration_ms)}
                                </TableCell>
                                {/* Labelled per phase rather than given a column each: for `daily` the top-level
                                    counts are the snapshot phase, but for a standalone `poll` run they are the
                                    report phase — one fixed header would be wrong for one of them. */}
                                <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                                    {reports ? (
                                        <>
                                            <span className="block">
                                                snapshots {run.processed}/{run.considered}
                                            </span>
                                            <span className="block">
                                                reports {reports.processed}/{reports.considered}
                                            </span>
                                        </>
                                    ) : (
                                        `${run.processed}/${run.considered}`
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Card>
    );
}

export function DisconnectedConnectionsTable({
    rows,
    stamp,
}: {
    rows: DisconnectedConnectionRow[];
    stamp: (d: Date) => string;
}) {
    return (
        <Card className="overflow-x-auto p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Ad accounts</TableHead>
                        <TableHead>Marked</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell className="text-sm">
                                {row.client.name}
                                <span className="text-muted-foreground"> · {row.client.email}</span>
                            </TableCell>
                            <TableCell>
                                <Badge variant="destructive" className="capitalize">
                                    {row.platform.toLowerCase()}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{row._count.ad_accounts}</TableCell>
                            {/* `updated_at` is @updatedAt, so this is "last write to the row", not
                                strictly "went dark at". Any other edit to the connection moves it. It is
                                the closest thing to a timestamp without a dedicated column — read it as
                                an upper bound on how long the grant has been dead. */}
                            <TableCell className="whitespace-nowrap text-sm">{stamp(row.updated_at)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}

export function StaleAccountsTable({ rows, stamp }: { rows: StaleAccountRow[]; stamp: (d: Date) => string }) {
    return (
        <Card className="overflow-x-auto p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Ad account</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Last synced</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((account) => (
                        <TableRow key={account.id}>
                            <TableCell className="text-sm">
                                {account.connection.client.name}
                                <span className="text-muted-foreground block text-xs">
                                    {account.connection.client.email}
                                </span>
                            </TableCell>
                            <TableCell className="text-sm">
                                {account.name ?? "—"}
                                <span className="text-muted-foreground block font-mono text-xs">
                                    {account.external_id}
                                </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{account.connection.platform}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                                {/* Never-synced sorts first and reads loudest: it means this account has not
                                    produced a single snapshot since it was connected. */}
                                {account.last_synced_at == null ? (
                                    <Badge variant="destructive">never</Badge>
                                ) : (
                                    stamp(account.last_synced_at)
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}

export function RecentFailuresTable({ rows, stamp }: { rows: FailureRow[]; stamp: (d: Date) => string }) {
    return (
        <Card className="overflow-x-auto p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead className="text-right">Client / account</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.id}>
                            <TableCell className="whitespace-nowrap text-sm">{stamp(row.created_at)}</TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{row.stage}</TableCell>
                            {/* Messages carry raw provider errors; wrap rather than truncate — the tail is
                                usually the part that identifies the cause. */}
                            <TableCell className="max-w-lg text-xs break-words whitespace-pre-wrap">
                                {row.message}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                                {row.client_id == null && row.ad_account_id == null
                                    ? "—"
                                    : [row.client_id && `c${row.client_id}`, row.ad_account_id && `a${row.ad_account_id}`]
                                          .filter(Boolean)
                                          .join(" / ")}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}
