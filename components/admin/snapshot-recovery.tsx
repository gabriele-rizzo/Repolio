"use client";

import {
    repullSnapshotRanges,
    scanSnapshotDamage,
    type AccountDamage,
} from "@/actions/admin/snapshot-recovery";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Check, DatabaseBackup, Circle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// Scan first, re-pull second, never both in one click — the same shape as AiTextRepair, for the same
// reason: a re-pull spends Zernio quota and rewrites rows that released reports were written from, so
// the exact day ranges are shown and can be deselected before anything is requested.

type Scanned = { scannedAccounts: number; from: string; to: string; damaged: AccountDamage[] };

/** Stable identity for one selectable range: an account plus its window. */
const rangeKey = (adAccountId: number, from: string, to: string) => `${adAccountId}:${from}:${to}`;

const label = (from: string, to: string, days: number) =>
    `${from === to ? from : `${from} → ${to}`} · ${days} day${days === 1 ? "" : "s"}`;

export function SnapshotRecovery() {
    const [scan, setScan] = useState<Scanned | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [scanning, startScan] = useTransition();
    const [repulling, startRepull] = useTransition();

    const busy = scanning || repulling;

    function onScan() {
        startScan(async () => {
            const result = await scanSnapshotDamage();

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            // Everything the scan found starts selected: the common case after an outage is "re-pull
            // all of it", and deselecting the odd account is less work than ticking thirty boxes.
            setSelected(
                new Set(
                    result.damaged.flatMap((account) =>
                        account.repull.map((r) => rangeKey(account.adAccountId, r.from, r.to)),
                    ),
                ),
            );
            setScan(result);

            toast.success(
                result.damaged.length === 0
                    ? `Scanned ${result.scannedAccounts} accounts — no damage found.`
                    : `Scanned ${result.scannedAccounts} accounts — ${result.damaged.length} look damaged.`,
            );
        });
    }

    function toggle(key: string) {
        setSelected((current) => {
            const next = new Set(current);
            if (!next.delete(key)) next.add(key);
            return next;
        });
    }

    function onRepull() {
        if (!scan) return;

        const requests = scan.damaged
            .map((account) => ({
                adAccountId: account.adAccountId,
                ranges: account.repull
                    .filter((r) => selected.has(rangeKey(account.adAccountId, r.from, r.to)))
                    .map((r) => ({ from: r.from, to: r.to })),
            }))
            .filter((request) => request.ranges.length > 0);

        startRepull(async () => {
            const result = await repullSnapshotRanges(requests);

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            result.failures.forEach((failure) => toast.error(failure));
            toast.success(
                `Re-pulled ${result.ranges} range${result.ranges === 1 ? "" : "s"} across ${result.accounts} account${result.accounts === 1 ? "" : "s"} — ${result.rows} rows written.`,
            );
            if (result.unresolved > 0) {
                // Not a failure: Zernio confirming a genuine no-delivery day looks identical to Zernio
                // still refusing to serve one, and only the operator knows which is plausible.
                toast.info(`${result.unresolved} days still returned nothing and were left untouched.`);
            }

            // Re-scan rather than clearing optimistically: a range Zernio still won't serve must stay
            // on screen, not vanish as if it had been healed.
            onScan();
        });
    }

    const selectedCount = selected.size;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <Typo as="muted" className="text-sm">
                    {scan == null
                        ? "Finds accounts with missing days, or with frozen all-zero runs left by a provider outage."
                        : `${scan.scannedAccounts} accounts scanned over ${scan.from} → ${scan.to} · ${scan.damaged.length} damaged.`}
                </Typo>

                <div className="flex flex-row gap-2">
                    <Button variant="outline" size="sm" onClick={onScan} disabled={busy}>
                        {scanning ? "Scanning…" : "Scan"}
                    </Button>
                    {selectedCount > 0 && (
                        <Button size="sm" onClick={onRepull} disabled={busy}>
                            {repulling ? "Re-pulling…" : `Re-pull ${selectedCount} range${selectedCount === 1 ? "" : "s"}`}
                        </Button>
                    )}
                </div>
            </div>

            {scan != null && scan.damaged.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <DatabaseBackup />
                        </EmptyMedia>
                        <EmptyTitle>No damage found</EmptyTitle>
                        <EmptyDescription>
                            Every active account has a complete run of days over the scan window, with no frozen
                            zero runs.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                scan?.damaged.map((account) => (
                    <Card key={account.adAccountId} className="gap-3 p-3">
                        <div className="flex flex-row flex-wrap items-baseline justify-between gap-2">
                            <Typo as="normal" className="text-sm font-medium">
                                {account.accountName}
                                <span className="text-muted-foreground">
                                    {" · "}
                                    {account.clientName} · #{account.adAccountId}
                                </span>
                            </Typo>
                            <div className="flex flex-row items-center gap-2">
                                {account.missing.length > 0 && (
                                    <Badge variant="destructive">
                                        {account.missing.length} gap{account.missing.length === 1 ? "" : "s"}
                                    </Badge>
                                )}
                                {account.suspectZero.length > 0 && (
                                    <Badge variant="secondary">
                                        {account.suspectZero.length} zero run
                                        {account.suspectZero.length === 1 ? "" : "s"}
                                    </Badge>
                                )}
                                <Typo as="muted" className="text-xs">
                                    {account.platform.toLowerCase()}
                                </Typo>
                            </div>
                        </div>

                        {/* What was detected, kept separate from what would be re-pulled: the re-pull
                            ranges are padded and merged, so they deliberately do not line up 1:1. */}
                        <div className="flex flex-col gap-1">
                            {account.missing.map((range) => (
                                <Typo as="muted" key={`m${range.from}`} className="font-mono text-xs">
                                    no row · {label(range.from, range.to, range.days)}
                                </Typo>
                            ))}
                            {account.suspectZero.map((range) => (
                                <Typo as="muted" key={`z${range.from}`} className="font-mono text-xs">
                                    all zeros · {label(range.from, range.to, range.days)}
                                </Typo>
                            ))}
                        </div>

                        {/* Toggles rather than checkboxes: this codebase has no checkbox primitive, and
                            adding one for a single admin screen is more surface than the screen is worth. */}
                        <div className="flex flex-row flex-wrap gap-2 border-t pt-2">
                            {account.repull.map((range) => {
                                const key = rangeKey(account.adAccountId, range.from, range.to);
                                const on = selected.has(key);

                                return (
                                    <Button
                                        key={key}
                                        type="button"
                                        size="sm"
                                        variant={on ? "secondary" : "outline"}
                                        aria-pressed={on}
                                        disabled={busy}
                                        onClick={() => toggle(key)}
                                        className="font-mono"
                                    >
                                        {on ? <Check /> : <Circle />}
                                        {label(range.from, range.to, range.days)}
                                    </Button>
                                );
                            })}
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
}
