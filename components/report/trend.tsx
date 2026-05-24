import type { Report } from "@/generated/prisma/browser";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "../ui/skeleton";

interface ReportTrendProps {
    report?: Report;
}

export function ReportTrend({ report }: ReportTrendProps) {
    const delta = report?.performance_score_delta;
    const trendUp = delta != null && delta >= 0;
    const TrendIcon = trendUp ? TrendingUp : TrendingDown;

    if (!report) return <Skeleton className="h-4 w-10" />;
    if (!delta) return <p>ciao</p>;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                trendUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
            )}
        >
            <TrendIcon className="size-3" />
            {trendUp ? "+" : ""}
            {delta}
        </span>
    );
}
