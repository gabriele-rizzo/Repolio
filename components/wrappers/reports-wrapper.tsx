"use client";

import type { ReportWithSnapshots } from "@/app/api/report/route";
import type { ScoreLabel } from "@/generated/prisma/browser";
import { compareDate } from "@/lib/date/compare";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { cn } from "@/lib/utils";
import { BookDashed, LineChart, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { DatePicker } from "../date-picker";
import { DynamicTable } from "../dynamic-table";
import { MetricCard } from "../metric-card";
import { PlatformBadge } from "../platform-badge";
import { ScoreTrend } from "../report/score-trend";
import { PageScaffold } from "../scaffolds/page-scaffold";
import { Typo } from "../typography";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";

const scoreColors: Record<ScoreLabel, string> = {
    STRONG: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    MODERATE: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    NEEDS_IMPROVEMENT: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const formatCurrency = (value: number) => currency.format(value);
const formatCompact = (value: number) => compact.format(value);

const fetchReports = async ([path, f, t]: readonly [string, string | null, string]) => {
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    params.set("to", t);

    const response = await fetch(`${path}?${params.toString()}`);
    const { data, error } = (await response.json()) as Result<ReportWithSnapshots[], string>;

    if (error) throw error;
    return data;
};

function aggregate(reports: ReportWithSnapshots[]) {
    let spend = 0;
    let revenue = 0;
    let revenueCount = 0;
    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let reach = 0;
    let reachCount = 0;

    for (const r of reports) {
        spend += r.spend;
        if (r.revenue != null) {
            revenue += r.revenue;
            revenueCount++;
        }
        impressions += r.impressions;
        clicks += r.clicks;
        conversions += r.conversions;
        if (r.reach != null) {
            reach += r.reach;
            reachCount++;
        }
    }

    return {
        spend,
        roas: revenueCount > 0 && spend > 0 ? revenue / spend : null,
        cpa: conversions > 0 ? spend / conversions : null,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        reach: reachCount > 0 ? reach : null,
    };
}

export function ReportsWrapper() {
    const router = useRouter();
    const [from, setFrom] = useState<Date | undefined>(undefined);
    const [to, setTo] = useState<Date>(new Date());

    const fromIso = from?.toISOString() ?? null;
    const toIso = to.toISOString();

    const { data, isLoading, mutate, error } = useSWR(["/api/report", fromIso, toIso] as const, fetchReports, {
        keepPreviousData: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        if (!data) return;
        for (const r of data) router.prefetch(`/dashboard/reports/${r.id}`);
    }, [data, router]);

    const rowHref = useCallback((report: ReportWithSnapshots) => `/dashboard/reports/${report.id}`, []);

    const aggregates = useMemo(() => (data && data.length > 0 ? aggregate(data) : undefined), [data]);
    const history = useMemo(
        () =>
            data
                ? [...data].reverse().map((r) => ({ created_at: r.created_at, performance_score: r.performance_score }))
                : undefined,
        [data],
    );

    const empty = data && data.length === 0;

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
                        className="w-36"
                    />

                    <DatePicker label="To" date={to} minDate={from} onChange={(date) => setTo(date)} className="w-36" />
                </>
            }
        >
            {error ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <TriangleAlert />
                        </EmptyMedia>

                        <EmptyTitle>Couldn&apos;t load reports</EmptyTitle>
                        <EmptyDescription>
                            Something went wrong fetching your reports. Please try again.
                        </EmptyDescription>
                    </EmptyHeader>

                    <EmptyContent>
                        <Button onClick={() => mutate()}>Retry</Button>
                    </EmptyContent>
                </Empty>
            ) : empty ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <BookDashed />
                        </EmptyMedia>

                        <EmptyTitle>Reports Collection Empty</EmptyTitle>
                        <EmptyDescription>
                            When a report will be created it will be shown here. In the meantime you can change your
                            report cadence setting.
                        </EmptyDescription>
                    </EmptyHeader>

                    <EmptyContent>
                        <Link href="/dashboard/account#recurrence">
                            <Button>Change Report Cadence</Button>
                        </Link>
                    </EmptyContent>
                </Empty>
            ) : (
                <div className="space-y-8">
                    <div className="space-y-3">
                        <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                            Totals across selected period
                        </Typo>

                        <div className="grid grid-cols-2 gap-4 *:h-24 md:grid-cols-3 xl:grid-cols-6">
                            <MetricCard
                                title="Spend"
                                value={aggregates?.spend}
                                format={formatCurrency}
                                betterWhen="neutral"
                                loading={isLoading}
                            />
                            <MetricCard
                                title="ROAS"
                                value={aggregates?.roas}
                                format={(v) => `${v.toFixed(2)}x`}
                                betterWhen="up"
                                loading={isLoading}
                            />
                            <MetricCard
                                title="CPA"
                                value={aggregates?.cpa}
                                format={formatCurrency}
                                betterWhen="down"
                                loading={isLoading}
                            />
                            <MetricCard
                                title="Conversions"
                                value={aggregates?.conversions}
                                format={(v) => v.toLocaleString("en-US")}
                                betterWhen="up"
                                loading={isLoading}
                            />
                            <MetricCard
                                title="CTR"
                                value={aggregates?.ctr}
                                format={(v) => `${v.toFixed(2)}%`}
                                betterWhen="up"
                                loading={isLoading}
                            />
                            <MetricCard
                                title="Reach"
                                value={aggregates?.reach}
                                format={formatCompact}
                                betterWhen="up"
                                loading={isLoading}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                            Score trend
                        </Typo>

                        <Card className="px-4 gap-3">
                            <div className="flex flex-row items-center gap-2 text-muted-foreground">
                                <LineChart className="size-3.5" />
                                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                                    Performance score over time
                                </Typo>
                            </div>

                            <div className="h-40 flex">
                                <ScoreTrend history={history} />
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-3">
                        <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                            Reports
                        </Typo>

                        <DynamicTable
                            caption="Reports available in the selected period."
                            columns={["period", "spend", "conversions", "roas", "score", "platforms"]}
                            data={data}
                            loading={isLoading}
                            href={rowHref}
                            render={(report, column) => {
                                if (column === "spend") return formatCurrency(report.spend);
                                if (column === "conversions") return report.conversions.toLocaleString("en-US");
                                if (column === "roas") return report.roas != null ? `${report.roas.toFixed(2)}x` : "—";

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
                    </div>
                </div>
            )}
        </PageScaffold>
    );
}
