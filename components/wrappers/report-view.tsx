"use client";

import type { Platform, Report } from "@/generated/prisma/browser";
import type { WindowMetrics } from "@/lib/metrics/window";
import type { ReportRef } from "@/lib/report/reports-page";
import { Brain } from "lucide-react";
import { useTranslations } from "next-intl";
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
    account: { id: number; name: string | null; platform: Platform; contextNote: string | null } | null;
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
    /** Read-only preview (admin simulation): hide client-scoped controls (window/switcher/context)
     *  that navigate into /dashboard or refetch under the client's session. */
    readOnly?: boolean;
}

// The window is exchanged as calendar-day identity, never as an instant. Snapshots and the
// /api/metrics query are keyed by UTC calendar day (one row per day, pinned to UTC midnight), while
// react-day-picker and toLocaleDateString both work in the browser's local time. So we hold
// local-midnight Dates in state — which keeps the picker and label showing the intended day in every
// timezone — and convert only at the edges: server instants in, YYYY-MM-DD day strings out.

/** A server instant's UTC calendar day, as a local-midnight Date. Uses UTC getters (not local) since
 *  the window is already UTC-based; reading it with local getters would shift it a day west of UTC. */
const localDayOf = (d: Date): Date => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** A local-midnight Date's calendar day as YYYY-MM-DD, which /api/metrics parses as UTC midnight. */
const dayParam = (d: Date): string =>
    `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;

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
    readOnly = false,
}: ReportViewProps) {
    const t = useTranslations("report");
    const [to, setTo] = useState<Date>(() => localDayOf(initialTo));
    const [from, setFrom] = useState<Date>(() => localDayOf(initialFrom));

    // Seeded with server-computed metrics for the report's period (no first-paint flash). On window
    // changes the key changes and SWR refetches; keepPreviousData holds the old values until they land.
    const { data } = useSWR(
        account ? (["/api/metrics", account.id, dayParam(from), dayParam(to)] as const) : null,
        fetchMetrics,
        { keepPreviousData: true, revalidateOnFocus: false, revalidateOnMount: false, fallbackData: initial },
    );

    return (
        <PageScaffold
            title={
                <div className="flex flex-row items-center gap-3">
                    <Typo as="title">{account?.name ?? t("fallbackTitle")}</Typo>
                    {account && <PlatformBadge platform={account.platform} />}
                </div>
            }
            description={t("description")}
            actions={
                <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                    {account && !readOnly && (
                        <DateRangePicker
                            from={from}
                            to={to}
                            onChange={(range) => {
                                setFrom(range.from);
                                setTo(range.to);
                            }}
                        />
                    )}

                    {account && !readOnly && reports.length > 0 && (
                        <ReportSwitcher
                            reports={reports}
                            currentId={report.id}
                            currentCreatedAt={report.created_at}
                            accountId={account.id}
                            hasMore={hasMore}
                        />
                    )}

                    {!readOnly && (
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <a
                                        href="#context"
                                        aria-label={t("addContext")}
                                        className={buttonVariants({ variant: "outline", size: "icon" })}
                                    >
                                        <Brain />
                                    </a>
                                }
                            />
                            <TooltipContent>{t("addContext")}</TooltipContent>
                        </Tooltip>
                    )}

                    <PrintButton reportId={report.id} />
                </div>
            }
        >
            <ReportWrapper
                report={report}
                account={account}
                current={data?.current}
                previous={data?.previous}
                loading={!data}
                readOnly={readOnly}
            />
        </PageScaffold>
    );
}
