"use client";

import { Typo } from "@/components/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

// See the note in notifications/loading.tsx for why these fallbacks are Client Components.
// Shape follows app/dashboard/template/page.tsx: heading, scope switcher, then the editor.
export default function ReportTemplateLoading() {
    const t = useTranslations("account.template");

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Typo as="title">{t("title")}</Typo>
                <Typo as="muted">{t("description")}</Typo>
            </div>

            {/* One scope button per ad account — count unknown until the query lands. */}
            <div className="flex flex-row flex-wrap items-center gap-2">
                {["w-24", "w-32", "w-28"].map((width) => (
                    <Skeleton key={width} className={`h-6 rounded-md ${width}`} />
                ))}
            </div>

            <Skeleton className="h-[28rem] w-full rounded-lg" />
        </div>
    );
}
