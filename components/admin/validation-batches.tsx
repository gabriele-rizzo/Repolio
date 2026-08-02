"use client";

import { collectAiResults, regenerateBatch, setReportApproval, validateAndSendBatch } from "@/actions/admin/validation";
import { PlatformBadge } from "@/components/platform-badge";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Platform } from "@/generated/prisma/browser";
import { Check, ExternalLink, LoaderCircle, RefreshCw, Send, Sparkles, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/** How far along a report's AI section is — decided on the server, rendered as a chip. */
export type ReportAiStatus = "READY" | "GENERATING" | "EMPTY";

export interface ValidationReportRow {
    id: number;
    accountName: string;
    platform: Platform | null;
    /** Preformatted "01 July – 30 July". */
    period: string;
    days: number;
    status: ReportAiStatus;
    recommendationCount: number;
    approved: boolean;
}

export interface ValidationBatchCard {
    id: number;
    clientName: string;
    clientEmail: string;
    company: string | null;
    /** Preformatted generation date. */
    createdLabel: string;
    reports: ValidationReportRow[];
}

const STATUS_META: Record<ReportAiStatus, { label: string; className: string }> = {
    READY: { label: "AI ready", className: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
    GENERATING: { label: "Generating", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
    EMPTY: { label: "No AI section", className: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" },
};

function ReportRow({
    row,
    disabled,
    onToggle,
}: {
    row: ValidationReportRow;
    disabled: boolean;
    onToggle: (approved: boolean) => void;
}) {
    const status = STATUS_META[row.status];

    return (
        <div
            className={`flex flex-row items-center justify-between gap-3 border-t py-3 ${
                row.approved ? "" : "opacity-50"
            }`}
        >
            <div className="min-w-0 space-y-1">
                <div className="flex flex-row items-center gap-2">
                    <Typo as="normal" className="truncate font-medium">
                        {row.accountName}
                    </Typo>
                    {row.platform && <PlatformBadge platform={row.platform} />}
                    <Badge variant="secondary" className={status.className}>
                        {status.label}
                    </Badge>
                    {!row.approved && <Badge variant="destructive">Excluded</Badge>}
                </div>

                <Typo as="muted" className="text-xs">
                    {row.period} · {row.days} {row.days === 1 ? "day" : "days"} ·{" "}
                    {row.recommendationCount === 1 ? "1 recommendation" : `${row.recommendationCount} recommendations`}
                </Typo>
            </div>

            <div className="flex shrink-0 flex-row items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    render={
                        <a href={`/api/admin/reports/${row.id}/pdf`} target="_blank" rel="noreferrer">
                            <ExternalLink />
                            Preview PDF
                        </a>
                    }
                />

                <Button
                    variant={row.approved ? "ghost" : "secondary"}
                    size="sm"
                    disabled={disabled}
                    onClick={() => onToggle(!row.approved)}
                >
                    {row.approved ? <Undo2 /> : <Check />}
                    {row.approved ? "Exclude" : "Include"}
                </Button>
            </div>
        </div>
    );
}

function BatchCard({ batch }: { batch: ValidationBatchCard }) {
    // Local mirror of each report's approval so toggling feels instant. The server action is the
    // source of truth: when it revalidates the page a fresh `batch.reports` array arrives, and this
    // drops the local copy for it — without that the optimistic state would outlive the server's
    // answer and, worse, hide what a regeneration did to these same rows.
    const [rows, setRows] = useState(batch.reports);
    const [mirrored, setMirrored] = useState(batch.reports);
    if (mirrored !== batch.reports) {
        setMirrored(batch.reports);
        setRows(batch.reports);
    }

    const [confirming, setConfirming] = useState(false);
    const [toggling, startToggle] = useTransition();
    const [sending, startSend] = useTransition();
    const [regenerating, startRegenerate] = useTransition();
    const [collecting, startCollect] = useTransition();

    const approved = rows.filter((r) => r.approved);
    const generating = approved.filter((r) => r.status === "GENERATING").length;
    const anyGenerating = rows.some((r) => r.status === "GENERATING");
    const busy = toggling || sending || regenerating || collecting;

    function onToggle(reportId: number, next: boolean) {
        setRows((current) => current.map((r) => (r.id === reportId ? { ...r, approved: next } : r)));
        setConfirming(false);

        startToggle(async () => {
            const result = await setReportApproval(reportId, next);
            if (result?.error) {
                // Roll the optimistic flip back — the server refused it.
                setRows((current) => current.map((r) => (r.id === reportId ? { ...r, approved: !next } : r)));
                toast.error(result.error);
            }
        });
    }

    function onRegenerate() {
        setConfirming(false);

        startRegenerate(async () => {
            const result = await regenerateBatch(batch.id);

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            // No optimistic status flip here: the action revalidates this page, so the rows come back
            // from the server already marked — and only the ones actually submitted, not the skipped ones.
            toast.success(
                `Regenerating ${result.submitted} ${result.submitted === 1 ? "report" : "reports"}${
                    result.skipped > 0 ? ` (${result.skipped} skipped)` : ""
                }. Same data, new write-up — check back in a minute.`,
            );
        });
    }

    function onCollect() {
        startCollect(async () => {
            const result = await collectAiResults();

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            if (result.applied > 0) {
                toast.success(`${result.applied} ${result.applied === 1 ? "report" : "reports"} updated.`);
            } else {
                toast.info(
                    result.stillPending > 0
                        ? "Still generating — give it another minute."
                        : "Nothing new to pick up.",
                );
            }
        });
    }

    function onSend() {
        if (!confirming) return setConfirming(true);

        setConfirming(false);
        startSend(async () => {
            const result = await validateAndSendBatch(batch.id);
            if (result?.error) toast.error(result.error);
            else
                toast.success(
                    `Sent ${approved.length} ${approved.length === 1 ? "report" : "reports"} to ${batch.clientName}.`,
                );
        });
    }

    return (
        <Card className="gap-0 p-4">
            <div className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
                <div className="min-w-0">
                    <Typo as="large" className="truncate">
                        {batch.clientName}
                        {batch.company && <span className="text-muted-foreground"> · {batch.company}</span>}
                    </Typo>
                    <Typo as="muted" className="truncate text-xs">
                        {batch.clientEmail} · generated {batch.createdLabel}
                    </Typo>
                </div>

                <Badge variant="outline">
                    {rows.length} {rows.length === 1 ? "report" : "reports"}
                </Badge>
            </div>

            {rows.map((row) => (
                <ReportRow key={row.id} row={row} disabled={busy} onToggle={(next) => onToggle(row.id, next)} />
            ))}

            <div className="flex flex-row flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Typo as="muted" className="text-xs">
                    {approved.length === 0
                        ? "Nothing approved — there is nothing to send."
                        : `One email to ${batch.clientEmail} with ${approved.length} ${
                              approved.length === 1 ? "PDF" : "PDFs"
                          } attached.`}
                    {generating > 0 &&
                        ` ${generating} still generating — ${
                            generating === 1 ? "it" : "they"
                        } would go out without an AI section.`}
                </Typo>

                <div className="flex flex-row flex-wrap items-center gap-2">
                    {confirming && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                            Cancel
                        </Button>
                    )}

                    {/* Only offered while something is in flight: outside that it has nothing to fetch. */}
                    {anyGenerating && (
                        <Button variant="ghost" size="sm" disabled={busy} onClick={onCollect}>
                            {collecting ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                            {collecting ? "Checking…" : "Check AI results"}
                        </Button>
                    )}

                    <Button variant="outline" size="sm" disabled={busy} onClick={onRegenerate}>
                        {regenerating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                        {regenerating ? "Submitting…" : "Regenerate"}
                    </Button>

                    <Button
                        size="sm"
                        variant={confirming ? "destructive" : "default"}
                        disabled={approved.length === 0 || busy}
                        onClick={onSend}
                    >
                        {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
                        {sending
                            ? "Sending…"
                            : confirming
                              ? `Confirm — email ${batch.clientName}`
                              : `Validate & send (${approved.length})`}
                    </Button>
                </div>
            </div>
        </Card>
    );
}

/**
 * The pending side of /admin/validation: one card per client batch, each report individually
 * includable, a "Regenerate" that rewrites the batch's AI sections against the same data, and a
 * single "Validate & send" that emails the client once with every approved report attached.
 *
 * Sending is the only action guarded by a confirm step — it is the one that is outward-facing and
 * irreversible. Regenerating stays inside the batch and leaves the existing text in place until the
 * new text lands.
 */
export function ValidationBatches({ batches }: { batches: ValidationBatchCard[] }) {
    return (
        <div className="space-y-4">
            {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} />
            ))}
        </div>
    );
}
