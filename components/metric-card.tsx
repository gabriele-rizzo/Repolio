import { cn } from "@/lib/utils";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Typo } from "./typography";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

type MetricDirection = "up" | "down" | "neutral";
type MetricStatus = "improvement" | "decrease" | "neutral";

interface MetricCardProps {
    title: string;
    value: number | null | undefined;
    previous?: number | null;
    format: (value: number) => React.ReactNode;
    /** Which direction of change is "good". Defaults to "up". Use "down" for cost-style metrics (CPA, CPM). */
    betterWhen?: MetricDirection;
    loading?: boolean;
}

function computeStatus(
    value: number | null | undefined,
    previous: number | null | undefined,
    betterWhen: MetricDirection,
): MetricStatus {
    if (value == null || previous == null) return "neutral";
    if (betterWhen === "neutral") return "neutral";

    if (previous === 0) {
        if (value === 0) return "neutral";
        const up = value > 0;
        return (up && betterWhen === "up") || (!up && betterWhen === "down") ? "improvement" : "decrease";
    }

    const change = ((value - previous) / Math.abs(previous)) * 100;
    if (Math.abs(change) < 0.05) return "neutral";

    const up = change > 0;
    return (up && betterWhen === "up") || (!up && betterWhen === "down") ? "improvement" : "decrease";
}

const STATUS_DOT: Record<MetricStatus, string> = {
    improvement: "bg-green-500",
    decrease: "bg-red-500",
    neutral: "bg-muted-foreground/40",
};

export function MetricCard({ title, value, previous, format, betterWhen = "up", loading }: MetricCardProps) {
    const status: MetricStatus = loading ? "neutral" : computeStatus(value, previous, betterWhen);

    return (
        <Card className="p-3 gap-0 flex flex-col items-start justify-between">
            <div className="w-full flex flex-row items-start justify-between gap-2">
                <Typo as="muted" className="text-xs uppercase">
                    {title}
                </Typo>

                <div className="flex flex-row items-center gap-1.5 shrink-0">
                    <ComparisonChip value={value} previous={previous} betterWhen={betterWhen} loading={loading} />
                    {!loading && (
                        <span aria-hidden className={cn("size-2 rounded-full shrink-0", STATUS_DOT[status])} />
                    )}
                </div>
            </div>

            {loading ? (
                <Skeleton className="h-7 w-20" />
            ) : value == null ? (
                <Typo as="title" className="text-muted-foreground">
                    —
                </Typo>
            ) : (
                <Typo as="title">{format(value)}</Typo>
            )}
        </Card>
    );
}

interface ComparisonChipProps {
    value: number | null | undefined;
    previous: number | null | undefined;
    betterWhen: MetricDirection;
    loading?: boolean;
}

function ComparisonChip({ value, previous, betterWhen, loading }: ComparisonChipProps) {
    const t = useTranslations("report");

    if (loading) return <Skeleton className="h-3.5 w-10" />;

    // No prior report at all — render nothing.
    if (previous === undefined) return null;

    // Current value is missing; nothing meaningful to compare.
    if (value == null) return null;

    // No prior recorded value but we do have a current one: signal "new".
    if (previous === null) {
        return <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t("new")}</span>;
    }

    // Previous was zero; percentage change is undefined. Show the raw direction without a number.
    if (previous === 0) {
        if (value === 0) return flat();
        return signed(value > 0, betterWhen, null);
    }

    const change = ((value - previous) / Math.abs(previous)) * 100;
    if (Math.abs(change) < 0.05) return flat();

    return signed(change > 0, betterWhen, change);
}

function flat() {
    return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            <Minus className="size-2.5" />0%
        </span>
    );
}

function signed(up: boolean, betterWhen: MetricDirection, change: number | null) {
    const good = betterWhen === "neutral" ? null : (up && betterWhen === "up") || (!up && betterWhen === "down");

    const color =
        good === null
            ? "text-muted-foreground"
            : good
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400";

    const Icon = up ? TrendingUp : TrendingDown;

    return (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums", color)}>
            <Icon className="size-2.5" />
            {change == null ? (up ? "↑" : "↓") : `${up ? "+" : ""}${change.toFixed(1)}%`}
        </span>
    );
}
