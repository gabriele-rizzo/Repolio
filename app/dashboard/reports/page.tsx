import { authorize } from "@/actions/auth/authorize";
import { AccountReport } from "@/components/wrappers/account-report";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { prisma } from "@/lib/prisma";
import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Reports | Repolio",
};

export default async function DashboardReportsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
    const client = await authorize();
    const { account: accountParam } = await searchParams;
    const accountId = accountParam ? Number(accountParam) : NaN;

    if (!Number.isInteger(accountId)) {
        return (
            <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Inbox />
                    </EmptyMedia>

                    <EmptyTitle>Select an ad account</EmptyTitle>
                    <EmptyDescription>
                        Pick an account from the sidebar to see its live metrics and latest report.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const account = await prisma.adAccount.findFirst({
        where: { id: accountId, connection: { client_id: client.id } },
        select: { id: true, name: true, connection: { select: { platform: true } } },
    });
    if (!account) notFound();

    const reports = await prisma.report.findMany({
        where: { snapshots: { some: { ad_account_id: account.id } } },
        orderBy: { created_at: "desc" },
        take: 12,
    });

    return (
        <AccountReport
            account={{ id: account.id, name: account.name, platform: account.connection.platform }}
            latest={reports[0] ?? null}
            reports={reports.map((report) => ({ id: report.id, created_at: report.created_at }))}
        />
    );
}
