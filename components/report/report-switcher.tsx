"use client";

import { dateFormatRelative } from "@/lib/date/format-relative";
import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface ReportSwitcherProps {
    reports: { id: number; created_at: Date }[];
    currentId: number;
    accountId: number;
}

/** Navigate between an account's reports. Each report keeps `?account` so the sidebar stays highlighted. */
export function ReportSwitcher({ reports, currentId, accountId }: ReportSwitcherProps) {
    const router = useRouter();
    const current = reports.find((report) => report.id === currentId);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button variant="outline">
                        {current ? dateFormatRelative(current.created_at) : "Select report"}
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
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
