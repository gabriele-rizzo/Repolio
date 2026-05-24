import { authorize } from "@/actions/auth/authorize";
import { getReport } from "@/actions/report/get-report";
import { BreadcrumbLabel } from "@/components/header/context";
import { PlatformBadge } from "@/components/platform-badge";
import { PageScaffold } from "@/components/scaffolds/page-scaffold";
import { Typo } from "@/components/typography";
import { ReportWrapper } from "@/components/wrappers/report-wrapper";
import { dateFormatRelative } from "@/lib/date/format-relative";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: PageProps<"/dashboard/reports/[id]">): Promise<Metadata> {
    const [{ id }, client] = await Promise.all([params, authorize()]);

    const report = await getReport(id, client.id);

    if (report) {
        const periodStart = report.snapshots[0]?.start_date ?? report.created_at;
        const period = `${dateFormatRelative(periodStart)} - ${dateFormatRelative(report.created_at)}`;

        return { title: `${period} | Repolio` };
    }

    return {};
}

export default async function DashboardReportPage({ params }: PageProps<"/dashboard/reports/[id]">) {
    const [{ id }, client] = await Promise.all([params, authorize()]);

    const report = await getReport(id, client.id);
    if (!report) notFound();

    const periodStart = report.snapshots[0]?.start_date ?? report.created_at;
    const period = `${dateFormatRelative(periodStart)} - ${dateFormatRelative(report.created_at)}`;

    const platforms = [...new Set(report.snapshots.map((s) => s.platform))];

    return (
        <>
            <BreadcrumbLabel segment={id} label={period} />

            <PageScaffold
                title={
                    <div className="flex flex-row gap-4 items-center">
                        <Typo as="title">{period}</Typo>

                        <div className="flex flex-row gap-2 items-center">
                            {platforms.map((p) => (
                                <PlatformBadge platform={p} key={p} />
                            ))}
                        </div>
                    </div>
                }
                description="This report analyzes your data from a series of daily snapshots."
            >
                <ReportWrapper report={report} />
            </PageScaffold>
        </>
    );
}
