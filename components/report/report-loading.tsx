"use client";

import { PageScaffold } from "@/components/scaffolds/page-scaffold";
import { ReportWrapper } from "@/components/wrappers/report-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

/**
 * The report view's loading shape, shared by both routes that lead to it: `/dashboard/reports`
 * (the resolver that redirects to an account's latest report) and `/dashboard/reports/[id]`.
 *
 * Shared on purpose — clicking an account in the sidebar passes through both boundaries, and when
 * they drew different shapes the skeleton visibly re-laid-out mid-navigation. Mirrors
 * components/wrappers/report-view.tsx: title + badge, its real description, the actions row, and
 * ReportWrapper's own loading state.
 */
export function ReportLoading() {
    const t = useTranslations("report");

    return (
        <PageScaffold
            title={
                <div className="flex min-w-0 flex-row flex-wrap items-center gap-3">
                    <Skeleton className="h-8 w-46 max-w-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                </div>
            }
            description={t("description")}
            actions={
                <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                    <Skeleton className="h-7 w-52" />
                    <Skeleton className="h-7 w-36" />
                    <Skeleton className="size-7" />
                    <Skeleton className="size-7" />
                </div>
            }
        >
            <ReportWrapper loading />
        </PageScaffold>
    );
}
