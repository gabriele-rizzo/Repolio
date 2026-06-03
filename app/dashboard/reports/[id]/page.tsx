import { authorize } from "@/actions/auth/authorize";
import { getReport } from "@/actions/report/get-report";
import { BreadcrumbLabel } from "@/components/header/context";
import { ReportView } from "@/components/wrappers/report-view";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { metricsForWindow, type WindowMetrics } from "@/lib/metrics/window";
import { prisma } from "@/lib/prisma";
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
    const [initial, reports] = account
        ? await Promise.all([
              metricsForWindow(account.id, from, to),
              prisma.report.findMany({
                  where: { snapshots: { some: { ad_account_id: account.id } } },
                  orderBy: { created_at: "desc" },
                  take: 12,
                  select: { id: true, created_at: true },
              }),
          ])
        : [{ current: null, previous: null } satisfies WindowMetrics, []];

    const period = `${dateFormatRelative(from)} - ${dateFormatRelative(to)}`;

    const accountView = account
        ? { id: account.id, name: account.name, platform: account.connection.platform }
        : null;

    return (
        <>
            <BreadcrumbLabel segment={id} label={period} />

            <ReportView
                key={report.id}
                report={report}
                account={accountView}
                reports={reports}
                from={from}
                to={to}
                initial={initial}
            />
        </>
    );
}
