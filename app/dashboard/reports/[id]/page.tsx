import { authorize } from "@/actions/auth/authorize";
import { getReport } from "@/actions/report/get-report";
import { BreadcrumbLabel } from "@/components/header/context";
import { ReportView } from "@/components/wrappers/report-view";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { metricsForWindow, type WindowMetrics } from "@/lib/metrics/window";
import { queryReportsPage, type ReportPage } from "@/lib/report/reports-page";
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

    // KPIs are computed live for the report's covered period (seeding the client window),
    // and we load the account's reports so the page can offer a switcher between them.
    const [initial, reportPage] = account
        ? await Promise.all([metricsForWindow(account.id, from, to), queryReportsPage(account.id)])
        : [{ current: null, previous: null } satisfies WindowMetrics, { items: [], hasMore: false } satisfies ReportPage];

    const period = `${dateFormatRelative(from)} - ${dateFormatRelative(to)}`;

    const accountView = account
        ? {
              id: account.id,
              name: account.name,
              platform: account.connection.platform,
              contextNote: account.context_note,
          }
        : null;

    return (
        <>
            <BreadcrumbLabel segment={id} label={period} />

            <ReportView
                key={report.id}
                report={report}
                account={accountView}
                reports={reportPage.items}
                hasMore={reportPage.hasMore}
                from={from}
                to={to}
                initial={initial}
            />
        </>
    );
}
