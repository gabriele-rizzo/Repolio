"use client";

import { listReports } from "@/actions/report/list-reports";
import { dateFormatRelative } from "@/lib/date/format-relative";
import type { ReportRef } from "@/lib/report/reports-page";
import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface ReportSwitcherProps {
    /** First page of the account's reports, newest first. Seeds the local list. */
    reports: ReportRef[];
    currentId: number;
    /** Created-at of the report being viewed — may be older than the seeded page. */
    currentCreatedAt: Date;
    accountId: number;
    /** Whether more reports exist beyond the seeded page. */
    hasMore: boolean;
}

/** Navigate between an account's reports. Each report keeps `?account` so the sidebar stays highlighted. */
export function ReportSwitcher({ reports: seed, currentId, currentCreatedAt, accountId, hasMore: seedHasMore }: ReportSwitcherProps) {
    const router = useRouter();
    const [reports, setReports] = useState(seed);
    const [hasMore, setHasMore] = useState(seedHasMore);
    const [pending, startTransition] = useTransition();

    const loadMore = () => {
        const cursor = reports[reports.length - 1]?.id;
        if (cursor == null) return;

        startTransition(async () => {
            try {
                const { items, hasMore: more } = await listReports(accountId, cursor);
                setReports((prev) => [...prev, ...items]);
                setHasMore(more);
            } catch {
                toast.error("Could not load more reports.");
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button variant="outline">
                        {dateFormatRelative(currentCreatedAt)}
                        <ChevronsUpDown />
                    </Button>
                }
            />

            <DropdownMenuContent align="start" className="min-w-48">
                <DropdownMenuRadioGroup
                    value={String(currentId)}
                    onValueChange={(value) => {
                        const id = Number(value);
                        if (id === currentId) return;
                        router.push(`/dashboard/reports/${id}?account=${accountId}`);
                    }}
                >
                    {reports.map((report) => (
                        <DropdownMenuRadioItem key={report.id} value={String(report.id)}>
                            {dateFormatRelative(report.created_at)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>

                {hasMore && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            closeOnClick={false}
                            disabled={pending}
                            onClick={loadMore}
                            className="justify-center text-muted-foreground"
                        >
                            {pending ? "Loading…" : "Load more"}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
