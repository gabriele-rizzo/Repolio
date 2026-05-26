"use client";

import type { FetchedReport } from "@/actions/report/get-report";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { ArrowRight } from "lucide-react";
import { DynamicTable } from "../dynamic-table";
import { MetricCard } from "../metric-card";
import { PlatformBadge } from "../platform-badge";
import { AIInsights } from "../report/ai-insights";
import { ReportOverview } from "../report/overview";
import { Typo } from "../typography";
import { Textarea } from "../ui/textarea";

interface ReportWrapperProps {
    report?: FetchedReport;
}

const currency = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
});

const formatCurrency = (value: number) => currency.format(value);
const formatCompact = (value: number) => compact.format(value);

export function ReportWrapper({ report }: ReportWrapperProps) {
    return (
        <div className="space-y-8">
            <ReportOverview report={report} />

            <div className="space-y-3">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    Metrics
                </Typo>

                <div className="grid grid-cols-3 xl:grid-cols-6 gap-4 *:h-24">
                    <MetricCard
                        title="Spend"
                        value={report?.spend}
                        previous={report?.previous?.spend}
                        format={formatCurrency}
                        betterWhen="neutral"
                        loading={!report}
                    />
                    <MetricCard
                        title="ROAS"
                        value={report?.roas}
                        previous={report?.previous?.roas}
                        format={(v) => `${v.toFixed(2)}x`}
                        betterWhen="up"
                        loading={!report}
                    />
                    <MetricCard
                        title="CPA"
                        value={report?.cpa}
                        previous={report?.previous?.cpa}
                        format={formatCurrency}
                        betterWhen="down"
                        loading={!report}
                    />
                    <MetricCard
                        title="Conversions"
                        value={report?.conversions}
                        previous={report?.previous?.conversions}
                        format={(v) => v.toLocaleString("en-US")}
                        betterWhen="up"
                        loading={!report}
                    />
                    <MetricCard
                        title="CTR"
                        value={report?.ctr}
                        previous={report?.previous?.ctr}
                        format={(v) => `${v.toFixed(2)}%`}
                        betterWhen="up"
                        loading={!report}
                    />
                    <MetricCard
                        title="Reach"
                        value={report?.reach}
                        previous={report?.previous?.reach}
                        format={formatCompact}
                        betterWhen="up"
                        loading={!report}
                    />
                </div>
            </div>

            <AIInsights report={report} />

            <div className="space-y-3" id="context">
                <div className="flex flex-row items-center justify-between">
                    <div className="flex flex-row items-center gap-1.5">
                        <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                            Context
                        </Typo>

                        <Typo as="muted" className="text-xs tracking-wide font-medium opacity-50">
                            Optional
                        </Typo>
                    </div>

                    <Typo
                        as="muted"
                        className="flex flex-row items-center gap-1.5 text-xs tracking-wide font-medium text-purple-300"
                    >
                        <ArrowRight className="size-3.5" />
                        Helps the AI
                    </Typo>
                </div>

                <Textarea placeholder="Help the AI by giving more context to this reporting period. Holidays, creative changes, budget changes, campaign launches…" />
            </div>

            <div className="space-y-3">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    Snapshots
                </Typo>

                <DynamicTable
                    caption="Snapshots are the daily data checkpoints the report is constructed from."
                    columns={["period", "platform"]}
                    data={report?.snapshots}
                    loading={typeof report === "undefined"}
                    loadingHeight={100}
                    className="border border-dashed"
                    href={(snapshot) => `/dashboard/snapshots/${snapshot.id}`}
                    render={(snapshot, column) => {
                        if (column === "period") {
                            const a = dateFormatRelative(snapshot.start_date);
                            const b = dateFormatRelative(snapshot.created_at);
                            return `${a} - ${b}`;
                        }

                        if (column === "platform") {
                            return (
                                <div className="flex justify-end">
                                    <PlatformBadge platform={snapshot.platform} />
                                </div>
                            );
                        }

                        return "Unimplemented";
                    }}
                />
            </div>
        </div>
    );
}
