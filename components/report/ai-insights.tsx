import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Typo } from "../typography";
import { Card } from "../ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { Skeleton } from "../ui/skeleton";
import { RecommendationCard, type Recommendation } from "./recommendation-card";

interface AIInsightsProps {
    recommendations?: Recommendation[];
    loading?: boolean;
}

/**
 * The AI section of the report page: the model's recommendations.
 *
 * The executive summary that used to head this block was removed — the report's prose now lives in
 * the trend explanation on the overview card, and the model is no longer asked for a summary at all.
 */
export function AIInsights({ recommendations = [], loading }: AIInsightsProps) {
    const t = useTranslations("report");

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-1.5 items-center text-purple-700 dark:text-purple-300">
                <Sparkles className="size-3.5" />
                <Typo as="small">{t("aiInsights")}</Typo>
            </div>

            <div className="flex flex-row items-center gap-2 text-muted-foreground">
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
