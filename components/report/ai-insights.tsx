import { ScrollText, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Typo } from "../typography";
import { Card } from "../ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { Skeleton } from "../ui/skeleton";
import { RecommendationCard, type Recommendation } from "./recommendation-card";

interface AIInsightsProps {
    summary?: string;
    recommendations?: Recommendation[];
    loading?: boolean;
}

export function AIInsights({ summary, recommendations = [], loading }: AIInsightsProps) {
    const t = useTranslations("report");

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-1.5 items-center text-purple-700 dark:text-purple-300">
                <Sparkles className="size-3.5" />
                <Typo as="small">{t("aiInsights")}</Typo>
            </div>

            <Card className="px-4 gap-3">
                <div className="flex flex-row items-center gap-2 text-muted-foreground">
                    <ScrollText className="size-3.5" />
                    <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                        {t("executiveSummary")}
                    </Typo>
                </div>

                {loading ? (
                    <div className="flex flex-col gap-2 *:h-3.5">
                        <Skeleton className="w-full" />
                        <Skeleton className="w-full" />
                        <Skeleton className="w-full" />
                        <Skeleton className="w-3/4" />
                    </div>
                ) : summary ? (
                    <Typo as="normal" className="leading-relaxed whitespace-pre-wrap">
                        {summary}
                    </Typo>
                ) : (
                    <Typo as="muted" className="italic">
                        {t("noSummary")}
                    </Typo>
                )}
            </Card>

            <div className="flex flex-row items-center gap-2 mt-2 text-muted-foreground">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    {t("recommendations")}
                </Typo>
                {!loading && recommendations.length > 0 && (
                    <Typo as="muted" className="text-xs">
                        · {recommendations.length}
                    </Typo>
                )}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <Card key={i} className="p-4 gap-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-4 w-1/2" />
                            <div className="flex flex-col gap-2 mt-1 *:h-3">
                                <Skeleton className="w-full" />
                                <Skeleton className="w-full" />
                                <Skeleton className="w-2/3" />
                            </div>
                        </Card>
                    ))}
                </div>
            ) : recommendations.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Sparkles />
                        </EmptyMedia>
                        <EmptyTitle>{t("noRecommendationsTitle")}</EmptyTitle>
                        <EmptyDescription>{t("noRecommendationsBody")}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendations.map((rec, i) => (
                        <RecommendationCard key={i} recommendation={rec} />
                    ))}
                </div>
            )}
        </div>
    );
}
