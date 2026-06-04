"use client";

import type { Platform, Report } from "@/generated/prisma/browser";
import type { WindowMetrics } from "@/lib/metrics/window";
import type { ReportRef } from "@/lib/report/reports-page";
import { Brain } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { DateRangePicker } from "../date-range-picker";
import { PlatformBadge } from "../platform-badge";
import { PrintButton } from "../report/print-button";
import { ReportSwitcher } from "../report/report-switcher";
import { PageScaffold } from "../scaffolds/page-scaffold";
import { Typo } from "../typography";
import { buttonVariants } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ReportWrapper } from "./report-wrapper";

interface ReportViewProps {
    /** The AI report being viewed (executive summary, recommendations, trend, context). */
    report: Report;
    /** The account this report belongs to. Null only for legacy reports with no resolvable account. */
    account: { id: number; name: string | null; platform: Platform } | null;
    /** The first page of the account's reports, newest first, seeding the switcher. */
    reports: ReportRef[];
    /** Whether more reports exist beyond the seeded page (drives the switcher's "Load more"). */
    hasMore: boolean;
    /** Start of the window (defaults to the period this report covers). */
    from: Date;
    /** End of the window (defaults to the period this report covers). */
    to: Date;
    /** Server-computed metrics for [from, to], used to seed SWR and avoid a loading flash. */
    initial: WindowMetrics;
}

const fetchMetrics = async ([path, account, from, to]: readonly [string, number, string, string]) => {
    const params = new URLSearchParams({ account: String(account), from, to });
    const response = await fetch(`${path}?${params.toString()}`);
    const { data, error } = (await response.json()) as Result<WindowMetrics, string>;

    if (error) throw error;
    return data;
};

export function ReportView({
    report,
    account,
    reports,
    hasMore,
    from: initialFrom,
    to: initialTo,
    initial,
}: ReportViewProps) {
    const [to, setTo] = useState<Date>(initialTo);
    const [from, setFrom] = useState<Date>(initialFrom);

    // Seeded with server-computed metrics for the report's period (no first-paint flash). On window
    // changes the key changes and SWR refetches; keepPreviousData holds the old values until they land.
    const { data } = useSWR(
        account ? (["/api/metrics", account.id, from.toISOString(), to.toISOString()] as const) : null,
        fetchMetrics,
        { keepPreviousData: true, revalidateOnFocus: false, revalidateOnMount: false, fallbackData: initial },
    );

    return (
        <PageScaffold
            title={
                <div className="flex flex-row items-center gap-3">
                    <Typo as="title">{account?.name ?? "Report"}</Typo>
                    {account && <PlatformBadge platform={account.platform} />}
                </div>
            }
            description="The AI write-up is for this report. Metrics are computed live for the selected window, which defaults to the period this report covers."
            actions={
                <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                    {account && (
                        <DateRangePicker
                            from={from}
                            to={to}
                            onChange={(range) => {
                                setFrom(range.from);
                                setTo(range.to);
                            }}
                        />
                    )}

                    {account && reports.length > 0 && (
                        <ReportSwitcher
                            reports={reports}
                            currentId={report.id}
                            currentCreatedAt={report.created_at}
                            accountId={account.id}
                            hasMore={hasMore}
                        />
                    )}

                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <a
                                    href="#context"
                                    aria-label="Add context"
                                    className={buttonVariants({ variant: "outline", size: "icon" })}
                                >
                                    <Brain />
                                </a>
                            }
                        />
                        <TooltipContent>Add context</TooltipContent>
                    </Tooltip>

                    <PrintButton reportId={report.id} />
                </div>
            }
        >
            <ReportWrapper report={report} current={data?.current} previous={data?.previous} loading={!data} />
        </PageScaffold>
    );
}
