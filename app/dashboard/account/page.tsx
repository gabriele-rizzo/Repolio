import { authorize } from "@/actions/auth/authorize";
import { ConnectButtons } from "@/components/account/connect-buttons";
import { ConnectionDelete } from "@/components/account/connection-delete";
import { ProfileAvatar } from "@/components/account/profile-avatar";
import { LanguageSettings } from "@/components/account/language-settings";
import { ProfileName } from "@/components/account/profile-name";
import { RecurrenceSettings } from "@/components/account/recurrence-settings";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signAvatarUrl } from "@/lib/avatar";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { toUtcDayString } from "@/lib/date/start-of-day";
import { PLATFORM_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { ZERNIO_PLATFORMS } from "@/lib/zernio/platform-map";
import { getLocale, getTranslations } from "next-intl/server";

export default async function AccountPage() {
    const client = await authorize();
    const [tSections, tStats, tConn, tDate, locale] = await Promise.all([
        getTranslations("account.sections"),
        getTranslations("account.stats"),
        getTranslations("account.connections"),
        getTranslations("date"),
        getLocale(),
    ]);
    const [nreports, nsnapshots, connections, avatar, recurrence] = await Promise.all([
        prisma.report.count({
            where: { snapshots: { some: { ad_account: { connection: { client_id: client.id } } } } },
        }),
        prisma.snapshot.count({
            where: { ad_account: { connection: { client_id: client.id } } },
        }),
        prisma.platformConnection.findMany({
            where: { client_id: client.id },
            include: { ad_accounts: { orderBy: { created_at: "asc" } } },
        }),
        signAvatarUrl(client.image),
        prisma.recurrence.findUnique({ where: { client_id: client.id } }),
    ]);

    const managedAccounts = connections.reduce((sum, connection) => sum + connection.ad_accounts.length, 0);
    const connectedPlatforms = connections.map((connection) => connection.platform);

    // Calendar days cross to the client as day strings, and "today" is resolved here so the schedule
    // preview reads the same UTC day the cron will.
    const startDate = recurrence?.start_date ? toUtcDayString(recurrence.start_date) : null;
    const today = toUtcDayString(new Date());

    return (
        <div className="space-y-4">
            <Card className="px-4">
                <ProfileAvatar name={client.name} image={avatar} />

                <div>
                    <ProfileName name={client.name} />
                    <Typo as="muted">{client.email}</Typo>
                </div>

                <div className="h-20 bg-muted border flex flex-row">
                    <div className="flex-1 flex p-4 justify-center flex-col">
                        <Typo as="large">{nreports}</Typo>
                        <Typo as="muted">{tStats("reports", { count: nreports })}</Typo>
                    </div>

                    <Separator orientation="vertical" />

                    <div className="flex-1 flex p-4 justify-center flex-col">
                        <Typo as="large">{nsnapshots}</Typo>
                        <Typo as="muted">{tStats("snapshots", { count: nsnapshots })}</Typo>
                    </div>

                    <Separator orientation="vertical" />

                    <div className="flex-1 flex p-4 justify-center flex-col">
                        <Typo as="large">{managedAccounts}</Typo>
                        <Typo as="muted">{tStats("managedAccounts", { count: managedAccounts })}</Typo>
                    </div>
                </div>
            </Card>

            <section id="recurrence" className="space-y-3 scroll-mt-20">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    {tSections("reporting")}
                </Typo>

                <RecurrenceSettings
                    schedule={{
                        mode: recurrence?.mode ?? "INTERVAL",
                        ndays: recurrence?.ndays ?? 30,
                        dayOfMonth: recurrence?.day_of_month ?? 1,
                        monthInterval: recurrence?.month_interval ?? 1,
                    }}
                    startDate={startDate}
                    today={today}
                />
            </section>

            <section id="language" className="space-y-3 scroll-mt-20">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    {tSections("preferences")}
                </Typo>

                <LanguageSettings locale={client.locale} auto={client.locale_auto} />
            </section>

            <div className="space-y-3">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    {tSections("connections")}
                </Typo>

                <div className="space-y-3">
                    {connections.map((connection) => {
                        const { label, icon: Icon } = PLATFORM_META[connection.platform];
                        const count = connection.ad_accounts.length;
                        const disconnected = connection.status === "DISCONNECTED";
                        const slug = ZERNIO_PLATFORMS[connection.platform]?.slug;

                        return (
                            <Card key={connection.id} className="gap-0 p-0">
                                <div className="flex flex-row items-center justify-between gap-3 p-4">
                                    <div className="flex min-w-0 flex-row items-center gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                            <Icon className="size-5" />
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex flex-row flex-wrap items-center gap-2">
                                                <Typo as="large" className="text-base">
                                                    {label}
                                                </Typo>
                                                {disconnected ? (
                                                    <Badge variant="destructive">{tConn("disconnected")}</Badge>
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                                    >
                                                        {tConn("connected")}
                                                    </Badge>
                                                )}
                                            </div>

                                            <Typo as="muted" className="text-xs">
                                                {tConn("connectedAt", {
                                                    date: dateFormatRelative(connection.created_at, {
                                                        locale,
                                                        t: tDate,
                                                    }),
                                                })}
                                            </Typo>

                                            {disconnected && slug && (
                                                <a
                                                    href={`/api/connect/${slug}`}
                                                    className={buttonVariants({
                                                        variant: "outline",
                                                        size: "sm",
                                                        className: "mt-2",
                                                    })}
                                                >
                                                    {tConn("reconnect")}
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <ConnectionDelete connectionId={connection.id} platform={connection.platform} />
                                </div>

                                <div className="space-y-2 border-t bg-muted/30 p-4">
                                    <Typo as="muted" className="text-[10px] font-medium tracking-wide uppercase">
                                        {tConn("adAccounts", { count })}
                                    </Typo>

                                    {count === 0 ? (
                                        <Typo as="muted" className="text-sm">
                                            {tConn("noAdAccounts")}
                                        </Typo>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {connection.ad_accounts.map((account) => (
                                                <div
                                                    key={account.id}
                                                    className="flex flex-row items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                                                >
                                                    <Typo as="normal" className="truncate text-sm font-medium">
                                                        {account.name ?? tConn("unnamedAccount")}
                                                    </Typo>
                                                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                                        {account.external_id}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}

                    <ConnectButtons exclude={connectedPlatforms} />
                </div>
            </div>
        </div>
    );
}
