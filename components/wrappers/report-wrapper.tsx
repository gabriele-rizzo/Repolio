"use client";

import type { FetchedReport } from "@/actions/report/get-report";
import { MetricCard } from "../metric-card";
import { AIInsights } from "../report/ai-insights";
import { ReportContextEditor } from "../report/context-editor";
import { ReportOverview } from "../report/overview";
import { Typo } from "../typography";

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

                <div className="grid grid-cols-2 gap-4 *:h-24 md:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
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

            {report && <ReportContextEditor reportId={report.id} initial={report.context_comment} />}
        </div>
    );
}
