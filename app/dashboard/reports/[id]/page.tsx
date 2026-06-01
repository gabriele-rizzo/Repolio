import { authorize } from "@/actions/auth/authorize";
import { getReport } from "@/actions/report/get-report";
import { BreadcrumbLabel } from "@/components/header/context";
import { PlatformBadge } from "@/components/platform-badge";
import { PrintButton } from "@/components/report/print-button";
import { PageScaffold } from "@/components/scaffolds/page-scaffold";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ReportWrapper } from "@/components/wrappers/report-wrapper";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { metricsForWindow } from "@/lib/metrics/window";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Report | Repolio",
};

export default async function DashboardReportPage({ params }: PageProps<"/dashboard/reports/[id]">) {
    const [{ id }, client] = await Promise.all([params, authorize()]);

    const fetched = await getReport(id, client.id);
    if (!fetched) notFound();

    const { report, account, from, to } = fetched;

    // KPIs are computed live for this report's covered period.
    const { current, previous } = account
        ? await metricsForWindow(account.id, from, to)
        : { current: null, previous: null };

    const period = `${dateFormatRelative(from)} - ${dateFormatRelative(to)}`;

    return (
        <>
            <BreadcrumbLabel segment={id} label={period} />

            <PageScaffold
                title={
                    <div className="flex flex-row gap-4 items-center">
                        <Typo as="title">{account?.name ?? "Report"}</Typo>

                        {account && (
                            <div className="mt-1">
                                <PlatformBadge platform={account.connection.platform} />
                            </div>
                        )}
                    </div>
                }
                description={`AI write-up from this report; metrics computed live for ${period}.`}
                actions={
                    <>
                        <a href="#context">
                            <Button variant="outline">
                                <Plus />
                                Context
                            </Button>
                        </a>

                        <PrintButton />
                    </>
                }
            >
                <ReportWrapper report={report} current={current} previous={previous} />
            </PageScaffold>
        </>
    );
}
