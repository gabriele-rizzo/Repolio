"use client";

import { Typo } from "@/components/typography";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

// See the note in notifications/loading.tsx for why these fallbacks are Client Components.
// Shape follows app/dashboard/account/page.tsx: profile card with the stats band, then the sections.
export default function AccountLoading() {
    const t = useTranslations("account.sections");

    return (
        <div className="space-y-4">
            <Card className="px-4">
                <Skeleton className="size-24 rounded-full" />

                <div className="space-y-2">
                    <Skeleton className="h-8 w-44" />
                    <Skeleton className="h-4 w-56" />
                </div>

                <div className="flex h-20 flex-row border bg-muted">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex flex-1 flex-row">
                            {index > 0 && <Separator orientation="vertical" />}

                            {/* The band is itself bg-muted, so a default Skeleton would be invisible on it. */}
                            <div className="flex flex-1 flex-col justify-center gap-1.5 p-4">
                                <Skeleton className="h-5 w-10 bg-muted-foreground/20" />
                                <Skeleton className="h-4 w-20 bg-muted-foreground/20" />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Section label={t("reporting")} height="h-56" />
            <Section label={t("preferences")} height="h-32" />
            <Section label={t("connections")} height="h-44" />
        </div>
    );
}

function Section({ label, height }: { label: string; height: string }) {
    return (
        <div className="space-y-3">
            <Typo as="muted" className="text-xs font-medium uppercase tracking-wide">
                {label}
            </Typo>

            <Skeleton className={`w-full rounded-lg ${height}`} />
        </div>
    );
}
