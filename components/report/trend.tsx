import type { FetchedReport } from "@/actions/report/get-report";
import { cn } from "@/lib/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

interface ReportTrendProps {
    report?: FetchedReport;
}

export function ReportTrend({ report }: ReportTrendProps) {
    if (!report) return <Skeleton className="h-4 w-24" />;

    const previous = report.previous_score;
    if (previous == null) {
        return <span className="text-xs font-medium text-muted-foreground">No prior report</span>;
    }

    const delta = report.performance_score - previous;

    if (delta === 0) {
        return (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                <Minus className="size-3" />0 vs last report
            </span>
        );
    }

    const trendUp = delta > 0;
    const TrendIcon = trendUp ? TrendingUp : TrendingDown;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                trendUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
            )}
        >
            <TrendIcon className="size-3" />
            {trendUp ? "+" : ""}
            {delta} vs last report
        </span>
    );
}
