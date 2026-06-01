import type { ScoreLabel } from "@/generated/prisma/browser";
import { Sparkles } from "lucide-react";
import { Typo } from "../typography";
import { Card } from "../ui/card";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";
import { RatingScale } from "./rating-scale";
import { ReportScoreBadge } from "./score-badge";

interface ReportOverviewProps {
    score?: number;
    label?: ScoreLabel;
    trendExplanation?: string;
    loading?: boolean;
}

export function ReportOverview({ score, label, trendExplanation, loading }: ReportOverviewProps) {
    return (
        <Card className="flex flex-col xl:flex-row px-4 gap-4">
            <div className="flex-1 flex flex-row gap-4">
                <div className="flex flex-col gap-3 shrink-0 min-w-40 justify-between">
                    <div className="flex flex-col gap-3 shrink-0 min-w-40">
                        <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                            Performance Score
                        </Typo>

                        <div className="flex flex-row items-baseline gap-1.5 shrink-0">
                            {loading ? (
                                <Skeleton className="w-20 h-13" />
                            ) : (
                                <Typo as="title" className="text-6xl leading-none tabular-nums">
                                    {score ?? "—"}
                                </Typo>
                            )}

                            <Typo as="muted" className="text-2xl shrink-0 leading-none">
                                / 100
                            </Typo>
                        </div>
                    </div>

                    <ReportScoreBadge label={label} loading={loading} />
                </div>

                <div className="grow min-h-40 flex flex-col justify-center">
                    <RatingScale score={loading ? undefined : score} label={label} />
                </div>
            </div>

            <Separator orientation="vertical" className="hidden xl:block" />
            <Separator orientation="horizontal" className="xl:hidden" />

            <div className="grow flex flex-col max-w-sm min-w-64 gap-2">
                <div className="flex flex-row gap-1.5 items-center text-purple-700 dark:text-purple-300">
                    <Sparkles className="size-3.5" />
                    <Typo as="small">AI Trend Explanation</Typo>
                </div>

                {loading ? (
                    <div className="grow w-full *:h-3.5 gap-2 flex flex-col">
                        <Skeleton className="w-full" />
                        <Skeleton className="w-full" />
                        <Skeleton className="w-2/3" />
                    </div>
                ) : (
                    <Typo as="muted" className="line-clamp-5">
                        {trendExplanation || "No trend explanation for this report yet."}
                    </Typo>
                )}
            </div>
        </Card>
    );
}
