import { cn } from "@/lib/utils";
import { CircleDot, Gauge, Megaphone, Target, Wallet, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Typo } from "../typography";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";

export type RecommendationPriority = "IMMEDIATE" | "THIS_WEEK" | "MONITOR";
export type RecommendationCategory = "BUDGET" | "CREATIVE" | "TARGETING" | "BIDDING";

export interface Recommendation {
    priority: RecommendationPriority;
    category: RecommendationCategory;
    title: string;
    body: string;
}

const PRIORITY_STYLES: Record<RecommendationPriority, { badge: string; rail: string }> = {
    IMMEDIATE: {
        badge: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
        rail: "bg-red-500",
    },
    THIS_WEEK: {
        badge: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        rail: "bg-amber-500",
    },
    MONITOR: {
        badge: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        rail: "bg-blue-500",
    },
};

const CATEGORY_ICON: Record<RecommendationCategory, LucideIcon> = {
    BUDGET: Wallet,
    CREATIVE: Megaphone,
    TARGETING: Target,
    BIDDING: Gauge,
};

interface RecommendationCardProps {
    recommendation: Recommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
    const tPriority = useTranslations("priority");
    const tCategory = useTranslations("category");

    const priority = PRIORITY_STYLES[recommendation.priority] ?? {
        badge: "bg-muted text-muted-foreground",
        rail: "bg-muted-foreground/40",
    };
    const Icon = CATEGORY_ICON[recommendation.category] ?? CircleDot;

    return (
        <Card className="relative p-4 gap-2 overflow-hidden">
            <div className={cn("absolute left-0 top-0 bottom-0 w-1", priority.rail)} aria-hidden />

            <div className="flex flex-row items-center justify-between gap-2 pl-2">
                <Badge variant="secondary" className={priority.badge}>
                    {tPriority(recommendation.priority)}
                </Badge>

                <div className="flex flex-row items-center gap-1 text-muted-foreground">
                    <Icon className="size-3.5" />
                    <Typo as="muted" className="text-xs">
                        {tCategory(recommendation.category)}
                    </Typo>
                </div>
            </div>

            <div className="flex flex-col gap-1 pl-2">
                <Typo as="large" className="text-sm">
                    {recommendation.title}
                </Typo>
                <Typo as="muted" className="leading-relaxed">
                    {recommendation.body}
                </Typo>
            </div>
        </Card>
    );
}
