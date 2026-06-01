import { authorize } from "@/actions/auth/authorize";
import { ConnectionDelete } from "@/components/account/connection-delete";
import { ProfileAvatar } from "@/components/account/profile-avatar";
import { ProfileName } from "@/components/account/profile-name";
import { RecurrenceSettings } from "@/components/account/recurrence-settings";
import { Typo } from "@/components/typography";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signAvatarUrl } from "@/lib/avatar";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { PLATFORM_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";

export default async function AccountPage() {
    const client = await authorize();
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
    const ndays = recurrence?.ndays ?? 30;

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
                        <Typo as="muted">{nreports === 1 ? "Report" : "Reports"}</Typo>
                    </div>

                    <Separator orientation="vertical" />

                    <div className="flex-1 flex p-4 justify-center flex-col">
                        <Typo as="large">{nsnapshots}</Typo>
                        <Typo as="muted">{nsnapshots === 1 ? "Snapshot" : "Snapshots"}</Typo>
                    </div>

                    <Separator orientation="vertical" />

                    <div className="flex-1 flex p-4 justify-center flex-col">
                        <Typo as="large">{managedAccounts}</Typo>
                        <Typo as="muted">{managedAccounts === 1 ? "Managed Account" : "Managed Accounts"}</Typo>
                    </div>
                </div>
            </Card>

            <section id="recurrence" className="space-y-3 scroll-mt-20">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    Reporting
                </Typo>

                <RecurrenceSettings ndays={ndays} />
            </section>

            <div className="space-y-3">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    Account Connections
                </Typo>

                <div className="space-y-3">
                    {connections.map((connection) => {
                        const { label, icon: Icon } = PLATFORM_META[connection.platform];
                        const count = connection.ad_accounts.length;

                        return (
                            <Card key={connection.id} className="gap-0 p-0">
                                <div className="flex flex-row items-center justify-between gap-3 p-4">
                                    <div className="flex min-w-0 flex-row items-center gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                            <Icon className="size-5" />
                                        </div>

                                        <div className="min-w-0">
                                            <Typo as="large" className="text-base">
                                                {label}
                                            </Typo>
                                            <Typo as="muted" className="text-xs">
                                                Connected {dateFormatRelative(connection.created_at)}
                                                {connection.expires_at &&
                                                    ` · Expires ${dateFormatRelative(connection.expires_at)}`}
                                            </Typo>
                                        </div>
                                    </div>

                                    <ConnectionDelete connectionId={connection.id} platform={connection.platform} />
                                </div>

                                <div className="space-y-2 border-t bg-muted/30 p-4">
                                    <Typo as="muted" className="text-[10px] font-medium tracking-wide uppercase">
                                        {count} ad {count === 1 ? "account" : "accounts"}
                                    </Typo>

                                    {count === 0 ? (
                                        <Typo as="muted" className="text-sm">
                                            No ad accounts found for this connection.
                                        </Typo>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {connection.ad_accounts.map((account) => (
                                                <div
                                                    key={account.id}
                                                    className="flex flex-row items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                                                >
                                                    <Typo as="normal" className="truncate text-sm font-medium">
                                                        {account.name ?? "Unnamed account"}
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
                </div>
            </div>
        </div>
    );
}
