import { ClientPicker } from "@/components/admin/client-picker";
import { TemplateAdminEditor } from "@/components/admin/template-admin-editor";
import { PlatformBadge } from "@/components/platform-badge";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TEMPLATE_BODY } from "@/lib/report/template/presets";
import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Templates | Repolio",
};

// Admin-side report template management. Same editor and same presets the client sees on
// /dashboard/template — the difference is that this page can reach any client, and previews against
// reports that haven't been validated yet.

export default async function AdminTemplatesPage({
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
    const selectedClient = Number.isInteger(clientId) ? clients.find((c) => c.id === clientId) ?? null : null;

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Typo as="title">Templates</Typo>
                <Typo as="muted">
                    The layout of a client&apos;s report PDF. Set their default, override a single ad account, or apply
                    a preset. Clients can edit the same templates themselves — last save wins.
                </Typo>
            </div>

            <ClientPicker clients={clients} selectedId={selectedClient?.id ?? null} basePath="/admin/templates" />

            {selectedClient ? (
                <ClientTemplates
                    clientId={selectedClient.id}
                    clientName={selectedClient.name}
                    accountParam={accountParam}
                />
            ) : (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <UsersRound />
                        </EmptyMedia>

                        <EmptyTitle>No client selected</EmptyTitle>
                        <EmptyDescription>Pick a client above to edit their report template.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </div>
    );
}

async function ClientTemplates({
    clientId,
    clientName,
    accountParam,
}: {
    clientId: number;
    clientName: string;
    accountParam?: string;
}) {
    const [accounts, clientTemplate] = await Promise.all([
        prisma.adAccount.findMany({
            where: { connection: { client_id: clientId } },
            orderBy: { created_at: "asc" },
            select: {
                id: true,
                name: true,
                connection: { select: { platform: true } },
                report_template: { select: { body: true } },
            },
        }),
        prisma.reportTemplate.findUnique({ where: { client_id: clientId }, select: { body: true } }),
    ]);

    const requested = accountParam ? Number(accountParam) : NaN;
    const selected = Number.isInteger(requested) ? accounts.find((a) => a.id === requested) ?? null : null;

    const clientBody = clientTemplate?.body ?? DEFAULT_TEMPLATE_BODY;
    const body = selected ? selected.report_template?.body ?? clientBody : clientBody;
    const stored = selected ? selected.report_template != null : clientTemplate != null;

    const base = `/admin/templates?client=${clientId}`;

    return (
        <div className="space-y-4">
            <div className="flex flex-row flex-wrap items-center gap-2">
                <Button
                    variant={selected ? "outline" : "default"}
                    size="sm"
                    render={<Link href={base}>Client default</Link>}
                />

                {accounts.map((account) => (
                    <Button
                        key={account.id}
                        variant={selected?.id === account.id ? "default" : "outline"}
                        size="sm"
                        render={
                            <Link href={`${base}&account=${account.id}`}>
                                <span className="truncate">{account.name ?? `Account #${account.id}`}</span>
                                {account.report_template && (
                                    <Badge variant="secondary" className="ml-1">
                                        Custom
                                    </Badge>
                                )}
                            </Link>
                        }
                    />
                ))}

                {accounts.length === 0 && (
                    <Typo as="muted" className="text-xs">
                        This client has no ad accounts yet — only their default template can be set.
                    </Typo>
                )}
            </div>

            {selected && (
                <div className="flex flex-row items-center gap-2">
                    <PlatformBadge platform={selected.connection.platform} />
                    <Typo as="muted" className="text-xs">
                        {selected.name ?? `Account #${selected.id}`}
                    </Typo>
                </div>
            )}

            <TemplateAdminEditor
                clientId={clientId}
                clientName={clientName}
                adAccountId={selected?.id ?? null}
                scopeLabel={selected ? (selected.name ?? `Account #${selected.id}`) : "the client default"}
                scopeHelp={
                    selected
                        ? "Overrides the client default for this ad account only. Reset to fall back to it."
                        : "Used for every one of this client's ad accounts that has no override of its own."
                }
                initialBody={body}
                stored={stored}
            />
        </div>
    );
}
