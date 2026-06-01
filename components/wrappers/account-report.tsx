"use client";

import type { Platform, Report } from "@/generated/prisma/browser";
import { compareDate } from "@/lib/date/compare";
import { dateFormatRelative } from "@/lib/date/format-relative";
import type { WindowMetrics } from "@/lib/metrics/window";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { DatePicker } from "../date-picker";
import { PlatformBadge } from "../platform-badge";
import { PageScaffold } from "../scaffolds/page-scaffold";
import { Typo } from "../typography";
import { ReportWrapper } from "./report-wrapper";

interface AccountReportProps {
    account: { id: number; name: string | null; platform: Platform };
    latest: Report | null;
    reports: { id: number; created_at: Date }[];
}

const DAY = 24 * 60 * 60 * 1000;

const fetchMetrics = async ([path, account, from, to]: readonly [string, number, string, string]) => {
    const params = new URLSearchParams({ account: String(account), from, to });
    const response = await fetch(`${path}?${params.toString()}`);
    const { data, error } = (await response.json()) as Result<WindowMetrics, string>;

    if (error) throw error;
    return data;
};

export function AccountReport({ account, latest, reports }: AccountReportProps) {
    const [to, setTo] = useState<Date>(() => new Date());
    const [from, setFrom] = useState<Date>(() => new Date(Date.now() - 30 * DAY));

    const { data, isLoading } = useSWR(
        ["/api/metrics", account.id, from.toISOString(), to.toISOString()] as const,
        fetchMetrics,
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    return (
        <PageScaffold
            title={
                <div className="flex flex-row items-center gap-3">
                    <Typo as="title">{account.name ?? "Ad account"}</Typo>
                    <PlatformBadge platform={account.platform} />
                </div>
            }
            description="Metrics are computed live for the selected window. The AI write-up is from this account's most recent report."
            actions={
                <>
                    <DatePicker
                        label="From"
                        date={compareDate(from, to, "min")}
                        onChange={(date) => date && setFrom(date)}
                        maxDate={to}
                        className="w-36"
                    />
                    <DatePicker
                        label="To"
                        date={to}
                        minDate={from}
                        onChange={(date) => date && setTo(date)}
                        className="w-36"
                    />
                </>
            }
        >
            <ReportWrapper
                report={latest ?? undefined}
                current={data?.current}
                previous={data?.previous}
                loading={isLoading}
            />

            {reports.length > 0 && (
                <div className="space-y-3">
                    <Typo as="muted" className="text-xs font-medium uppercase tracking-wide">
                        Past reports
                    </Typo>

                    <div className="divide-y overflow-hidden rounded-lg border">
                        {reports.map((report) => (
                            <Link
                                key={report.id}
                                href={`/dashboard/reports/${report.id}`}
                                className="flex flex-row items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50"
                            >
                                <Typo as="small">Report</Typo>
                                <Typo as="muted" className="text-xs">
                                    {dateFormatRelative(report.created_at)}
                                </Typo>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </PageScaffold>
    );
}
