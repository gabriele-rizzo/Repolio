import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
}

export interface StaleAccountRow {
    id: number;
    name: string | null;
    external_id: string;
    last_synced_at: Date | null;
    connection: { platform: string; client: { name: string; email: string } };
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
                        <TableHead className="text-right">Clients</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((run) => (
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
                                ) : run.failed > 0 ? (
                                    <Badge variant="destructive">{run.failed} failed</Badge>
                                ) : run.skipped > 0 ? (
                                    <Badge variant="secondary">deferred {run.skipped}</Badge>
                                ) : (
                                    <Badge variant="outline">ok</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{seconds(run.duration_ms)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                                {run.processed}/{run.considered}
                            </TableCell>
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
