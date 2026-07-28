import type { ScoreLabel } from "@/generated/prisma/browser";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
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
    const t = useTranslations("report");

    return (
        <Card className="flex flex-col xl:flex-row px-4 gap-4">
            {/* Stat column: score sits at the top, the rating scale is pinned to the bottom (justify-between),
                so the column fills its height and stays balanced however long the trend explanation runs. */}
            <div className="flex w-full shrink-0 flex-col justify-between gap-6 xl:w-72">
                <div className="flex flex-col gap-3">
                    <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                        {t("performanceScore")}
                    </Typo>

                    <div className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex flex-row items-baseline gap-1.5">
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

                        <ReportScoreBadge label={label} loading={loading} />
                    </div>
                </div>

                <RatingScale score={loading ? undefined : score} label={label} />
            </div>

            <Separator orientation="vertical" className="hidden xl:block" />
            <Separator orientation="horizontal" className="xl:hidden" />

            <div className="grow flex flex-col gap-2 min-w-64">
                <div className="flex flex-row gap-1.5 items-center text-purple-700 dark:text-purple-300">
                    <Sparkles className="size-3.5" />
                    <Typo as="small">{t("trendExplanation")}</Typo>
                </div>

                {loading ? (
                    <div className="grow w-full *:h-3.5 gap-2 flex flex-col">
                        <Skeleton className="w-full" />
                        <Skeleton className="w-full" />
                        <Skeleton className="w-2/3" />
                    </div>
                ) : (
                    <Typo as="muted" className="whitespace-pre-wrap">
                        {trendExplanation || t("noTrend")}
                    </Typo>
                )}
            </div>
        </Card>
    );
}
