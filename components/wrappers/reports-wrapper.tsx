"use client";

import type { ReportWithSnapshots } from "@/app/api/report/route";
import type { ScoreLabel } from "@/generated/prisma/browser";
import { compareDate } from "@/lib/date/compare";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { cn } from "@/lib/utils";
import { BookDashed } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { DatePicker } from "../date-picker";
import { DynamicTable } from "../dynamic-table";
import { PlatformBadge } from "../platform-badge";
import { PageScaffold } from "../scaffolds/page-scaffold";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";

const scoreColors: Record<ScoreLabel, string> = {
    STRONG: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    MODERATE: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    NEEDS_IMPROVEMENT: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const fetchReports = async ([path, f, t]: readonly [string, string | null, string]) => {
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    params.set("to", t);

    const response = await fetch(`${path}?${params.toString()}`);
    const { data, error } = (await response.json()) as Result<ReportWithSnapshots[], string>;

    if (error) throw error;
    return data;
};

export function ReportsWrapper() {
    const router = useRouter();
    const [from, setFrom] = useState<Date | undefined>(undefined);
    const [to, setTo] = useState<Date>(new Date());

    const fromIso = from?.toISOString() ?? null;
    const toIso = to.toISOString();

    const { data, isLoading, mutate } = useSWR(["/api/report", fromIso, toIso] as const, fetchReports, {
        keepPreviousData: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        if (!data) return;
        for (const r of data) router.prefetch(`/dashboard/reports/${r.id}`);
    }, [data, router]);

    const rowHref = useCallback((report: ReportWithSnapshots) => `/dashboard/reports/${report.id}`, []);

    return (
        <PageScaffold
            title="Reports"
            description="A report is what we put together at the end of every period for you. It shows how your ads performed, compares it to last time, flags what's working and what isn't, and completes it with a summary and clear next steps."
            onShow={() => mutate()}
            actions={
                <>
                    <DatePicker
                        label="From"
                        date={compareDate(from, to, "min")}
                        onChange={(date) => setFrom(date)}
                        maxDate={to}
                    />

                    <DatePicker label="To" date={to} minDate={from} onChange={(date) => setTo(date)} />
                </>
            }
        >
            {data && data.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <BookDashed />
                        </EmptyMedia>

                        <EmptyTitle>Reports Collection Empty</EmptyTitle>
                        <EmptyDescription>
                            When a report will be created it will be shown here. In the meantime you can change your
                            recurrence options.
                        </EmptyDescription>
                    </EmptyHeader>

                    <EmptyContent>
                        <Link href="/dashboard/account#recurrence">
                            <Button>Change Recurrence</Button>
                        </Link>
                    </EmptyContent>
                </Empty>
            ) : (
                <DynamicTable
                    caption="Reports available in the selected period."
                    columns={["period", "spend", "conversions", "roas", "score", "platforms"]}
                    data={data}
                    loading={isLoading}
                    href={rowHref}
                    render={(report, column) => {
                        if (column === "spend") return report.spend;
                        if (column === "conversions") return report.conversions;
                        if (column === "roas") return report.roas?.toFixed(2) ?? "—";

                        if (column === "period") {
                            const start = report.snapshots[0]?.start_date ?? report.created_at;
                            const a = dateFormatRelative(start);
                            const b = dateFormatRelative(report.created_at);

                            return `${a} - ${b}`;
                        } else if (column === "score") {
                            return (
                                <Badge className={cn(scoreColors[report.score_label])}>
                                    {report.performance_score}
                                </Badge>
                            );
                        } else if (column === "platforms") {
                            const platforms = Array.from(new Set(report.snapshots.map((s) => s.platform)));

                            return (
                                <div className="flex flex-wrap justify-end gap-1">
                                    {platforms.map((p) => (
                                        <PlatformBadge key={p} platform={p} />
                                    ))}
                                </div>
                            );
                        }

                        return "Unimplemented";
                    }}
                />
            )}
        </PageScaffold>
    );
}
