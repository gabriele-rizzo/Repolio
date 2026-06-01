import type { ScoreLabel } from "@/generated/prisma/browser";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";

export const SCORE_COLORS: Record<ScoreLabel, string> = {
    STRONG: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    MODERATE: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    NEEDS_IMPROVEMENT: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function ReportScoreBadge({ label, loading }: { label?: ScoreLabel; loading?: boolean }) {
    if (loading) return <Skeleton className="h-5 w-20" />;
    if (!label) return null;

    return (
        <Badge variant="secondary" className={SCORE_COLORS[label]}>
            {label.replace("_", " ")}
        </Badge>
    );
}
