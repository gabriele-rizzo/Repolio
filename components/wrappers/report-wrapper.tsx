"use client";

import type { Report, Snapshot } from "@/generated/prisma/browser";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { DynamicTable } from "../dynamic-table";
import { PlatformBadge } from "../platform-badge";
import { ReportOverview } from "../report/overview";
import { Typo } from "../typography";

interface ReportWrapperProps {
    report?: Report & { snapshots: Snapshot[] };
}

export function ReportWrapper({ report }: ReportWrapperProps) {
    return (
        <>
            <ReportOverview report={report} />

            <Typo as="normal">Snapshots</Typo>
            <DynamicTable
                caption="Snapshots are the daily data checkpoints the report is constructed from."
                columns={["period", "platform"]}
                data={report?.snapshots}
                loading={typeof report === "undefined"}
                loadingHeight={100}
                className="border border-dashed"
                href={(snapshot) => `/dashboard/snapshots/${snapshot.id}`}
                render={(snapshot, column) => {
                    if (column === "period") {
                        const a = dateFormatRelative(snapshot.start_date);
                        const b = dateFormatRelative(snapshot.created_at);
                        return `${a} - ${b}`;
                    }

                    if (column === "platform") {
                        return (
                            <div className="flex justify-end">
                                <PlatformBadge platform={snapshot.platform} />
                            </div>
                        );
                    }

                    return "Unimplemented";
                }}
            />
        </>
    );
}
