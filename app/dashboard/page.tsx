import { authorize } from "@/actions/auth/authorize";
import { ConnectButtons } from "@/components/account/connect-buttons";
import { ConnectionStatusToast } from "@/components/account/connection-status-toast";
import { PlatformBadge } from "@/components/platform-badge";
import { SCORE_COLORS } from "@/components/report/score-badge";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { currencyFormatter } from "@/lib/format/currency";
import { accountFocus } from "@/lib/metrics/cards";
import { computeMetrics } from "@/lib/metrics/compute";
import { prisma } from "@/lib/prisma";
import { Link2Off } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Home | Repolio",
};

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const DAY = 24 * 60 * 60 * 1000;

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
                        <ConnectButtons />
                    </EmptyContent>
                </Empty>
            </>
        );
    }

    // A quick at-a-glance preview: live metrics over the last 30 days per account.
    // Server component renders once per request, so a request-time window is fine.
    // eslint-disable-next-line react-hooks/purity
    const since = new Date(Date.now() - 30 * DAY);
    const cards = await Promise.all(
        adAccounts.map(async (account) => {
            const [snapshots, lastReport] = await Promise.all([
                prisma.snapshot.findMany({ where: { ad_account_id: account.id, start_date: { gte: since } } }),
                prisma.report.findFirst({
                    where: { snapshots: { some: { ad_account_id: account.id } } },
                    orderBy: { created_at: "desc" },
                    select: { created_at: true },
                }),
            ]);

            return { account, metrics: computeMetrics(snapshots), lastReportAt: lastReport?.created_at ?? null };
        }),
    );

    const platforms = new Set(adAccounts.map((a) => a.connection.platform));

    return (
        <div className="space-y-6">
            {statusToast}

            <div className="space-y-1">
                <Typo as="title">Home</Typo>
                <Typo as="muted">
                    A quick look at the {adAccounts.length} ad {adAccounts.length === 1 ? "account" : "accounts"} you
                    manage across {platforms.size} {platforms.size === 1 ? "platform" : "platforms"}. Open one for live
                    metrics and its latest report.
                </Typo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map(({ account, metrics, lastReportAt }) => (
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

                            {metrics ? (
                                <>
                                    <div className="flex flex-row items-center justify-between gap-2">
                                        <div className="flex flex-row items-baseline gap-1">
                                            <Typo as="title">{metrics.performance_score}</Typo>
                                            <Typo as="muted" className="text-xs">
                                                / 100
                                            </Typo>
                                        </div>

                                        <Badge variant="secondary" className={SCORE_COLORS[metrics.score_label]}>
                                            {metrics.score_label.replace("_", " ")}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 border-t pt-3">
                                        <Stat
                                            label="Spend"
                                            value={currencyFormatter(metrics.currency, 0).format(metrics.spend)}
                                        />
                                        {accountFocus(metrics) === "leadgen" ? (
                                            // Lead-gen accounts have no ROAS by definition — lead with CPL.
                                            <Stat
                                                label="CPL"
                                                value={
                                                    metrics.cpl != null
                                                        ? currencyFormatter(metrics.currency).format(metrics.cpl)
                                                        : "—"
                                                }
                                            />
                                        ) : (
                                            <Stat
                                                label="ROAS"
                                                value={metrics.roas != null ? `${metrics.roas.toFixed(2)}x` : "—"}
                                            />
                                        )}
                                        <Stat label="Conv." value={compact.format(metrics.conversions)} />
                                    </div>

                                    <Typo as="muted" className="text-xs">
                                        Last 30 days ·{" "}
                                        {lastReportAt ? `report ${dateFormatRelative(lastReportAt)}` : "no report yet"}
                                    </Typo>
                                </>
                            ) : (
                                <div className="border-t pt-3">
                                    <Typo as="muted" className="text-sm">
                                        No data in the last 30 days yet.
                                    </Typo>
                                </div>
                            )}
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
