"use client";

import { repairDamagedReports, scanDamagedReports, type DamagedReport } from "@/actions/admin/repair-ai-text";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Wand2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// The fourth question /admin/health answers: is any report a client can open still carrying the
// model's own JSON debris? Reports generated before lib/ai/sanitize.ts existed can, and unlike the
// other panels on this page there is something to DO about it — so this one has buttons.
//
// Scan first, repair second, and never both in one click: repairing rewrites rows that were already
// emailed, so the diff is shown before anything is written.

export function AiTextRepair() {
    const [scanned, setScanned] = useState<number | null>(null);
    const [damaged, setDamaged] = useState<DamagedReport[]>([]);
    const [scanning, startScan] = useTransition();
    const [repairing, startRepair] = useTransition();

    function onScan() {
        startScan(async () => {
            const result = await scanDamagedReports();

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            setScanned(result.scanned);
            setDamaged(result.damaged);
            toast.success(`Scanned ${result.scanned} reports — ${result.damaged.length} need repair.`);
        });
    }

    function onRepair() {
        startRepair(async () => {
            const result = await repairDamagedReports(damaged.map((r) => r.id));

            if ("error" in result) {
                toast.error(result.error);
                return;
            }

            // Re-scan rather than clearing optimistically: a row that failed its re-check on the server
            // must stay visible, not disappear as if it had been fixed.
            setDamaged([]);
            toast.success(`Repaired ${result.repaired} reports.`);
            onScan();
        });
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <Typo as="muted" className="text-sm">
                    {scanned == null
                        ? "Finds reports whose stored AI text carries JSON debris from a derailed generation."
                        : `${scanned} most recent reports scanned · ${damaged.length} need repair.`}
                </Typo>

                <div className="flex flex-row gap-2">
                    <Button variant="outline" size="sm" onClick={onScan} disabled={scanning || repairing}>
                        {scanning ? "Scanning…" : "Scan"}
                    </Button>
                    {damaged.length > 0 && (
                        <Button size="sm" onClick={onRepair} disabled={scanning || repairing}>
                            {repairing ? "Repairing…" : `Repair ${damaged.length}`}
                        </Button>
                    )}
                </div>
            </div>

            {scanned != null && damaged.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Wand2 />
                        </EmptyMedia>
                        <EmptyTitle>Nothing to repair</EmptyTitle>
                        <EmptyDescription>No report in that range carries model debris.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                damaged.map((report) => (
                    <Card key={report.id} className="gap-2 p-3">
                        <Typo as="normal" className="text-sm font-medium">
                            {report.accountName}
                            <span className="text-muted-foreground"> · {report.clientName} · #{report.id}</span>
                        </Typo>

                        <Typo as="muted" className="text-xs line-through decoration-red-500/60">
                            {report.before}
                        </Typo>
                        <Typo as="muted" className="text-xs text-foreground">
                            {report.after}
                        </Typo>

                        {report.droppedRecommendations > 0 && (
                            <Typo as="muted" className="text-xs">
                                {report.droppedRecommendations} recommendation
                                {report.droppedRecommendations === 1 ? "" : "s"} would be dropped as unreadable.
                            </Typo>
                        )}
                    </Card>
                ))
            )}
        </div>
    );
}
