import { authorize } from "@/actions/auth/authorize";
import { ConnectionStatusToast } from "@/components/account/connection-status-toast";
import { PlatformBadge } from "@/components/platform-badge";
import { SCORE_COLORS } from "@/components/report/score-badge";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { prisma } from "@/lib/prisma";
import { Link2Off } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Home | Repolio",
};

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5">
            <Typo as="muted" className="text-[10px] uppercase tracking-wide">
                {label}
            </Typo>
            <Typo as="normal" className="text-sm font-medium tabular-nums">
                {value}
            </Typo>
        </div>
    );
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ meta_connected?: string; meta_error?: string }>;
}) {
    const client = await authorize();

    const { meta_connected, meta_error } = await searchParams;
    const statusToast = <ConnectionStatusToast connected={meta_connected === "1"} error={meta_error} />;

    const adAccounts = await prisma.adAccount.findMany({
        where: { connection: { client_id: client.id } },
        orderBy: { created_at: "asc" },
        include: { connection: { select: { platform: true } } },
    });

    const reports = await Promise.all(
        adAccounts.map((account) =>
            prisma.report.findFirst({
                where: { snapshots: { some: { ad_account_id: account.id } } },
                orderBy: { created_at: "desc" },
            }),
        ),
    );

    if (adAccounts.length === 0) {
        return (
            <>
                {statusToast}
                <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Link2Off />
                    </EmptyMedia>

                    <EmptyTitle>No Ad Accounts Yet</EmptyTitle>
                    <EmptyDescription>
                        Connect a platform to start pulling in your ad accounts. Each one gets its own performance
                        reports.
                    </EmptyDescription>
                </EmptyHeader>

                <EmptyContent>
                    <a href="/api/meta/connect" className={buttonVariants()}>
                        Connect Facebook
                    </a>
                </EmptyContent>
                </Empty>
            </>
        );
    }

    const platforms = new Set(adAccounts.map((a) => a.connection.platform));

    return (
        <div className="space-y-6">
            {statusToast}

            <div className="space-y-1">
                <Typo as="title">Home</Typo>
                <Typo as="muted">
                    A quick look at the {adAccounts.length} ad{" "}
                    {adAccounts.length === 1 ? "account" : "accounts"} you manage across {platforms.size}{" "}
                    {platforms.size === 1 ? "platform" : "platforms"}. Open one to see its full reports.
                </Typo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {adAccounts.map((account, index) => {
                    const report = reports[index];

                    return (
                        <Link
                            key={account.id}
                            href={`/dashboard/reports?account=${account.id}`}
                            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Card className="p-4 gap-3 h-full ring-foreground/10 transition-colors hover:ring-foreground/25">
                                <div className="flex flex-row items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <Typo as="large" className="truncate">
                                            {account.name ?? "Unnamed account"}
                                        </Typo>
                                        <Typo as="muted" className="text-xs truncate">
                                            {account.external_id}
                                        </Typo>
                                    </div>

                                    <PlatformBadge platform={account.connection.platform} />
                                </div>

                                {report ? (
                                    <>
                                        <div className="flex flex-row items-center justify-between gap-2">
                                            <div className="flex flex-row items-baseline gap-1">
                                                <Typo as="title">{report.performance_score}</Typo>
                                                <Typo as="muted" className="text-xs">
                                                    / 100
                                                </Typo>
                                            </div>

                                            <Badge variant="secondary" className={SCORE_COLORS[report.score_label]}>
                                                {report.score_label.replace("_", " ")}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 border-t pt-3">
                                            <Stat label="Spend" value={currency.format(report.spend)} />
                                            <Stat
                                                label="ROAS"
                                                value={report.roas != null ? `${report.roas.toFixed(2)}x` : "—"}
                                            />
                                            <Stat label="Conv." value={compact.format(report.conversions)} />
                                        </div>

                                        <Typo as="muted" className="text-xs">
                                            Updated {dateFormatRelative(report.created_at)}
                                        </Typo>
                                    </>
                                ) : (
                                    <div className="border-t pt-3">
                                        <Typo as="muted" className="text-sm">
                                            No reports yet. The first one appears after the next cycle.
                                        </Typo>
                                    </div>
                                )}
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
