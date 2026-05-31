import { authorize } from "@/actions/auth/authorize";
import { PlatformBadge } from "@/components/platform-badge";
import { Typo } from "@/components/typography";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { prisma } from "@/lib/prisma";
import { userInitials } from "@/lib/user/initials";
import { Pen, Trash } from "lucide-react";
import { Fragment } from "react";

export default async function AccountPage() {
    const client = await authorize();
    const [nreports, nsnapshots, connections] = await Promise.all([
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
    ]);

    const managedAccounts = connections.reduce((sum, connection) => sum + connection.ad_accounts.length, 0);

    return (
        <div className="space-y-4">
            <Card className="px-4">
                <button className="relative w-fit group">
                    <Avatar className="size-24 group-hover:opacity-75">
                        <AvatarFallback className="text-2xl">{userInitials(client.name)}</AvatarFallback>
                    </Avatar>

                    <div className="absolute size-7 flex items-center justify-center bg-muted bottom-0.5 right-0.5 border-4 border-card rounded-full">
                        <Pen className="size-3 group-hover:opacity-50" />
                    </div>
                </button>

                <div>
                    <Typo as="title">{client.name}</Typo>
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

            <div className="space-y-3">
                <Typo as="muted" className="text-xs uppercase tracking-wide font-medium">
                    Account Connections
                </Typo>

                <div className="border">
                    {connections.map((connection, index, list) => (
                        <Fragment key={connection.id}>
                            <div className="pl-4 pr-2.5 py-2.5 space-y-3 relative group">
                                <Button
                                    variant="destructive"
                                    className="not-group-hover:hidden not-group-hover:pointer-events-none absolute top-2 right-2 size-6"
                                >
                                    <Trash />
                                </Button>

                                <div className="flex flex-row justify-between items-start gap-2">
                                    <div className="flex flex-col gap-1">
                                        <PlatformBadge platform={connection.platform} />

                                        {connection.expires_at && (
                                            <div className="flex flex-row gap-1.5">
                                                <Typo as="muted">Expires at:</Typo>
                                                <Typo as="normal" className="text-sm">
                                                    {dateFormatRelative(connection.expires_at)}
                                                </Typo>
                                            </div>
                                        )}
                                    </div>

                                    <Typo as="muted">{dateFormatRelative(connection.created_at)}</Typo>
                                </div>

                                <div className="space-y-1">
                                    {connection.ad_accounts.length === 0 ? (
                                        <Typo as="muted" className="text-sm">
                                            No ad accounts found for this connection.
                                        </Typo>
                                    ) : (
                                        connection.ad_accounts.map((account) => (
                                            <div
                                                key={account.id}
                                                className="flex flex-row items-center justify-between gap-2 border bg-muted px-2.5 py-1.5"
                                            >
                                                <Typo as="normal" className="text-sm truncate">
                                                    {account.name ?? "Unnamed account"}
                                                </Typo>
                                                <Typo as="muted" className="text-xs shrink-0">
                                                    {account.external_id}
                                                </Typo>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {index !== list.length - 1 && <Separator orientation="horizontal" />}
                        </Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}
