import type { Report } from "@/generated/prisma/browser";
import type { ComputedMetrics } from "@/lib/metrics/meta";
import { MetricCard } from "../metric-card";
import { AIInsights } from "../report/ai-insights";
import { ReportContextEditor } from "../report/context-editor";
import { ReportOverview } from "../report/overview";
import { type Recommendation } from "../report/recommendation-card";
import { Typo } from "../typography";

interface ReportWrapperProps {
    /** The AI report (executive summary, recommendations, trend explanation, context). */
    report?: Report;
    /** Live metrics for the selected window. */
    current?: ComputedMetrics | null;
    /** Live metrics for the preceding equal-length window (for deltas). */
    previous?: ComputedMetrics | null;
    loading?: boolean;
}

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const formatCurrency = (value: number) => currency.format(value);
const formatCompact = (value: number) => compact.format(value);

export function ReportWrapper({ report, current, previous, loading }: ReportWrapperProps) {
    const recommendations = (report?.recommendations ?? []) as unknown as Recommendation[];

    return (
        <div className="space-y-8">
            <ReportOverview
                score={current?.performance_score}
                label={current?.score_label}
                trendExplanation={report?.trend_explanation}
                loading={loading}
            />

            <div className="space-y-3">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    Metrics
                </Typo>

                <div className="grid grid-cols-2 gap-4 *:h-24 md:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
                    <MetricCard
                        title="Spend"
                        value={current?.spend}
                        previous={previous?.spend}
                        format={formatCurrency}
                        betterWhen="neutral"
                        loading={loading}
                    />
                    <MetricCard
                        title="ROAS"
                        value={current?.roas}
                        previous={previous?.roas}
                        format={(v) => `${v.toFixed(2)}x`}
                        betterWhen="up"
                        loading={loading}
                    />
                    <MetricCard
                        title="CPA"
                        value={current?.cpa}
                        previous={previous?.cpa}
                        format={formatCurrency}
                        betterWhen="down"
                        loading={loading}
                    />
                    <MetricCard
                        title="Conversions"
                        value={current?.conversions}
                        previous={previous?.conversions}
                        format={(v) => v.toLocaleString("en-US")}
                        betterWhen="up"
                        loading={loading}
                    />
                    <MetricCard
                        title="CTR"
                        value={current?.ctr}
                        previous={previous?.ctr}
                        format={(v) => `${v.toFixed(2)}%`}
                        betterWhen="up"
                        loading={loading}
                    />
                    <MetricCard
                        title="Reach"
                        value={current?.reach}
                        previous={previous?.reach}
                        format={formatCompact}
                        betterWhen="up"
                        loading={loading}
                    />
                </div>
            </div>

            <AIInsights summary={report?.executive_summary} recommendations={recommendations} loading={loading} />

            {report && <ReportContextEditor reportId={report.id} initial={report.context_comment} />}
        </div>
    );
}
