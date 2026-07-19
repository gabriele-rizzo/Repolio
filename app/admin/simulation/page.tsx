import { getReport } from "@/actions/report/get-report";
import { ClientPicker } from "@/components/admin/client-picker";
import { HomeOverview } from "@/components/dashboard/home-overview";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ReportView } from "@/components/wrappers/report-view";
import { metricsForWindow, type WindowMetrics } from "@/lib/metrics/window";
import { prisma } from "@/lib/prisma";
import { queryReportsPage, type ReportPage } from "@/lib/report/reports-page";
import { ArrowLeft, ScrollText, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Simulation | Repolio",
};

interface SelectedClient {
    id: number;
    name: string;
}

export default async function SimulationPage({
    searchParams,
}: {
    searchParams: Promise<{ client?: string; account?: string }>;
}) {
    const { client: clientParam, account: accountParam } = await searchParams;

    const clients = await prisma.client.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, company: true },
    });

    const clientId = clientParam ? Number(clientParam) : NaN;
    const selected = Number.isInteger(clientId) ? clients.find((c) => c.id === clientId) ?? null : null;

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Typo as="title">Simulation</Typo>
                <Typo as="muted">
                    Preview the client-facing dashboard exactly as a client sees it. Read-only — no connections or edits.
                </Typo>
            </div>

            <ClientPicker clients={clients} selectedId={selected?.id ?? null} />

            {!selected ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <UsersRound />
                        </EmptyMedia>

                        <EmptyTitle>No client selected</EmptyTitle>
                        <EmptyDescription>Pick a client above to preview their dashboard.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <SimulationPreview client={selected} accountParam={accountParam} />
            )}
        </div>
    );
}

// Renders the selected client's view: their Home overview, or — when an account is chosen — that
// account's latest report, read-only. Mirrors app/dashboard/* but scoped by client id, never by session.
async function SimulationPreview({ client, accountParam }: { client: SelectedClient; accountParam?: string }) {
    const accountId = accountParam ? Number(accountParam) : NaN;

    if (!Number.isInteger(accountId)) {
        return (
            <HomeOverview
                clientId={client.id}
                reportHref={(id) => `/admin/simulation?client=${client.id}&account=${id}`}
            />
        );
    }

    // Only allow drilling into accounts that belong to the selected client.
    const account = await prisma.adAccount.findFirst({
        where: { id: accountId, connection: { client_id: client.id } },
        select: { id: true, name: true },
    });
    if (!account) notFound();

    const backLink = (
        <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2"
            render={
                <Link href={`/admin/simulation?client=${client.id}`}>
                    <ArrowLeft />
                    Back to {client.name}&apos;s home
                </Link>
            }
        />
    );

    const latest = await prisma.report.findFirst({
        where: { snapshots: { some: { ad_account_id: account.id } } },
        orderBy: { created_at: "desc" },
        select: { id: true },
    });

    if (!latest) {
        return (
            <div className="space-y-4">
                {backLink}
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ScrollText />
                        </EmptyMedia>

                        <EmptyTitle>No reports yet</EmptyTitle>
                        <EmptyDescription>
                            {(account.name ?? "This account") + " "} doesn&apos;t have any reports yet.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </div>
        );
    }

    const fetched = await getReport(String(latest.id), client.id);
    if (!fetched) notFound();

    const { report, account: reportAccount, from, to } = fetched;

    // KPIs computed live for the report's covered period (same as the real report page), so the
    // read-only preview shows real numbers without any client-session refetch.
    const [initial, reportPage] = reportAccount
        ? await Promise.all([metricsForWindow(reportAccount.id, from, to), queryReportsPage(reportAccount.id)])
        : [
              { current: null, previous: null } satisfies WindowMetrics,
              { items: [], hasMore: false } satisfies ReportPage,
          ];

    const accountView = reportAccount
        ? { id: reportAccount.id, name: reportAccount.name, platform: reportAccount.connection.platform }
        : null;

    return (
        <div className="space-y-4">
            {backLink}

            <ReportView
                key={report.id}
                report={report}
                account={accountView}
                reports={reportPage.items}
                hasMore={reportPage.hasMore}
                from={from}
                to={to}
                initial={initial}
                readOnly
            />
        </div>
    );
}
