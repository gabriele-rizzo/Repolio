import { authorize } from "@/actions/auth/authorize";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { prisma } from "@/lib/prisma";
import { RELEASED_REPORT } from "@/lib/report/visibility";
import { Inbox, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
    title: "Reports | Repolio",
};

// The account-level URL is a resolver: it sends you to the account's latest report,
// which is the single canonical view (live metrics + that report's AI write-up).
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
        select: { id: true, name: true },
    });
    if (!account) notFound();

    const latest = await prisma.report.findFirst({
        where: { snapshots: { some: { ad_account_id: account.id } }, ...RELEASED_REPORT },
        orderBy: { created_at: "desc" },
        select: { id: true },
    });

    if (!latest) {
        return (
            <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <ScrollText />
                    </EmptyMedia>

                    <EmptyTitle>No reports yet</EmptyTitle>
                    <EmptyDescription>
                        {(account.name ?? "This account") + " "} doesn&apos;t have any reports yet. They&apos;re
                        generated automatically — check back soon.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    redirect(`/dashboard/reports/${latest.id}?account=${account.id}`);
}
