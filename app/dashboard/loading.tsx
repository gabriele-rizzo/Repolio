"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Typo } from "@/components/typography";
import { useTranslations } from "next-intl";

// See the note in notifications/loading.tsx for why these fallbacks are Client Components.
// Shape follows components/dashboard/home-overview.tsx: heading, then the account card grid.
export default function DashboardHomeLoading() {
    const t = useTranslations("home");

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Typo as="title">{t("title")}</Typo>
                {/* The summary counts the accounts, so it can't be known yet. */}
                <Skeleton className="h-4 w-full max-w-xl" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Card key={index} className="h-full gap-3 p-4">
                        <div className="flex flex-row items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1.5">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-20" />
                            </div>

                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>

                        <div className="flex flex-row items-center justify-between gap-2">
                            <Skeleton className="h-7 w-14" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t pt-3">
                            {Array.from({ length: 3 }).map((_, stat) => (
                                <div key={stat} className="space-y-1.5">
                                    <Skeleton className="h-2.5 w-10" />
                                    <Skeleton className="h-3.5 w-14" />
                                </div>
                            ))}
                        </div>

                        <Skeleton className="h-3 w-40 max-w-full" />
                    </Card>
                ))}
            </div>
        </div>
    );
}
