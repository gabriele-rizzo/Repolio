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
import { RELEASED_REPORT } from "@/lib/report/visibility";
import { Link2Off } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

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

interface HomeOverviewProps {
    /** The client whose ad accounts and metrics to render. */
    clientId: number;
    /** Where each account card links to (the account's reports view). */
    reportHref: (accountId: number) => string;
    /** Rendered in the empty state (e.g. connect buttons). Omit for a read-only preview. */
    emptyAction?: React.ReactNode;
}

// The client's Home: a per-ad-account metric card grid (live 30-day metrics + latest report age).
// Shared by the real /dashboard and the admin read-only simulation, which differ only in where the
// cards link and whether the empty state offers a connect action.
export async function HomeOverview({ clientId, reportHref, emptyAction }: HomeOverviewProps) {
    const [t, tMetrics, tScore] = await Promise.all([
        getTranslations("home"),
        getTranslations("metrics"),
        getTranslations("score"),
    ]);

    const adAccounts = await prisma.adAccount.findMany({
        where: { connection: { client_id: clientId } },
        orderBy: { created_at: "asc" },
        include: { connection: { select: { platform: true } } },
    });

    if (adAccounts.length === 0) {
        return (
            <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Link2Off />
                    </EmptyMedia>

                    <EmptyTitle>{t("noAccountsTitle")}</EmptyTitle>
                    <EmptyDescription>{t("noAccountsBody")}</EmptyDescription>
                </EmptyHeader>

                {emptyAction && <EmptyContent>{emptyAction}</EmptyContent>}
            </Empty>
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
                    // Released only: an unvalidated report must not age the "last report" line.
                    where: { snapshots: { some: { ad_account_id: account.id } }, ...RELEASED_REPORT },
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
            <div className="space-y-1">
                <Typo as="title">{t("title")}</Typo>
                <Typo as="muted">{t("summary", { accounts: adAccounts.length, platforms: platforms.size })}</Typo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map(({ account, metrics, lastReportAt }) => (
                    <Link
                        key={account.id}
                        href={reportHref(account.id)}
                        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Card className="p-4 gap-3 h-full ring-foreground/10 transition-colors hover:ring-foreground/25">
                            <div className="flex flex-row items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <Typo as="large" className="truncate">
                                        {account.name ?? t("unnamedAccount")}
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
                                            {tScore(metrics.score_label)}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 border-t pt-3">
                                        <Stat
                                            label={tMetrics("spend")}
                                            value={currencyFormatter(metrics.currency, 0).format(metrics.spend)}
                                        />
                                        {accountFocus(metrics) === "leadgen" ? (
                                            // Lead-gen accounts have no ROAS by definition — lead with CPL.
                                            <Stat
                                                label={tMetrics("cpl")}
                                                value={
                                                    metrics.cpl != null
                                                        ? currencyFormatter(metrics.currency).format(metrics.cpl)
                                                        : "—"
                                                }
                                            />
                                        ) : (
                                            <Stat
                                                label={tMetrics("roas")}
                                                value={metrics.roas != null ? `${metrics.roas.toFixed(2)}x` : "—"}
                                            />
                                        )}
                                        <Stat label={t("conv")} value={compact.format(metrics.conversions)} />
                                    </div>

                                    <Typo as="muted" className="text-xs">
                                        {t("last30")} ·{" "}
                                        {lastReportAt
                                            ? t("reportAge", { date: dateFormatRelative(lastReportAt) })
                                            : t("noReportYet")}
                                    </Typo>
                                </>
                            ) : (
                                <div className="border-t pt-3">
                                    <Typo as="muted" className="text-sm">
                                        {t("noData")}
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
