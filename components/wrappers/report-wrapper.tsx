import type { Report } from "@/generated/prisma/browser";
import { currencyFormatter } from "@/lib/format/currency";
import { accountFocus, METRIC_CARD_DEFS, metricValue, selectKpiCards, type MetricFormat } from "@/lib/metrics/cards";
import type { ComputedMetrics } from "@/lib/metrics/compute";
import { useTranslations } from "next-intl";
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
    /** Read-only preview (admin simulation): hide the context editor and other mutating controls. */
    readOnly?: boolean;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const formatCompact = (value: number) => compact.format(value);

export function ReportWrapper({ report, current, previous, loading, readOnly }: ReportWrapperProps) {
    const t = useTranslations("report");
    const tMetrics = useTranslations("metrics");

    const recommendations = (report?.recommendations ?? []) as unknown as Recommendation[];

    // Currency comes from the account's metrics; fall back to EUR while metrics are still loading.
    const currencyCode = current?.currency ?? previous?.currency ?? "EUR";
    const formatCurrency = (value: number) => currencyFormatter(currencyCode).format(value);

    const formatters: Record<MetricFormat, (v: number) => string> = {
        currency: formatCurrency,
        percent: (v) => `${v.toFixed(2)}%`,
        multiplier: (v) => `${v.toFixed(2)}x`,
        count: (v) => v.toLocaleString("en-US"),
        compact: formatCompact,
        decimal: (v) => v.toFixed(2),
    };

    // Card set follows what the account measurably optimizes for (lead-gen accounts lead with
    // Leads/CPL instead of an "n/a" ROAS). See lib/metrics/cards.ts.
    const cards = selectKpiCards(accountFocus(current, previous));

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
                    {t("metrics")}
                </Typo>

                <div className="grid grid-cols-2 gap-4 *:h-24 md:grid-cols-3 xl:grid-cols-6 print:grid-cols-3">
                    {cards.map((key) => {
                        const def = METRIC_CARD_DEFS[key];
                        return (
                            <MetricCard
                                key={key}
                                title={tMetrics(key)}
                                value={current ? metricValue(current, key) : undefined}
                                previous={previous ? metricValue(previous, key) : undefined}
                                format={formatters[def.format]}
                                betterWhen={def.betterWhen}
                                loading={loading}
                            />
                        );
                    })}
                </div>
            </div>

            <AIInsights summary={report?.executive_summary} recommendations={recommendations} loading={loading} />

            {report && !readOnly && <ReportContextEditor reportId={report.id} initial={report.context_comment} />}
        </div>
    );
}
