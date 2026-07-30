import { authorize } from "@/actions/auth/authorize";
import { PlatformBadge } from "@/components/platform-badge";
import { TemplateScopeEditor } from "@/components/report/template-scope-editor";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TEMPLATE_BODY } from "@/lib/report/template/presets";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Report template | Repolio",
};

// Where a client shapes their report document. The template drives the DELIVERABLE — the PDF attached
// to their report email, and the "Download PDF" render — not this dashboard's interactive report view,
// which stays a live surface with a re-windowable date range.
//
// Scope is chosen through the URL: no `account` param edits the client's default, `?account=<id>` edits
// that account's override.
export default async function ReportTemplatePage({
    searchParams,
}: {
    searchParams: Promise<{ account?: string }>;
}) {
    const [client, { account: accountParam }, t] = await Promise.all([
        authorize(),
        searchParams,
        getTranslations("account.template"),
    ]);

    const accounts = await prisma.adAccount.findMany({
        where: { connection: { client_id: client.id } },
        orderBy: { created_at: "asc" },
        select: {
            id: true,
            name: true,
            connection: { select: { platform: true } },
            report_template: { select: { body: true } },
        },
    });

    const clientTemplate = await prisma.reportTemplate.findUnique({
        where: { client_id: client.id },
        select: { body: true },
    });

    const requested = accountParam ? Number(accountParam) : NaN;
    const selected = Number.isInteger(requested) ? accounts.find((a) => a.id === requested) ?? null : null;
    if (accountParam && !selected) notFound();

    const clientBody = clientTemplate?.body ?? DEFAULT_TEMPLATE_BODY;

    // What this scope currently renders with, and whether that is its own or inherited.
    const body = selected ? selected.report_template?.body ?? clientBody : clientBody;
    const stored = selected ? selected.report_template != null : clientTemplate != null;

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Typo as="title">{t("title")}</Typo>
                <Typo as="muted">{t("description")}</Typo>
            </div>

            {/* Scope switcher: the client default, plus one tab per ad account. */}
            <div className="flex flex-row flex-wrap items-center gap-2">
                <Button
                    variant={selected ? "outline" : "default"}
                    size="sm"
                    render={<Link href="/dashboard/template">{t("scopeDefault")}</Link>}
                />

                {accounts.map((account) => (
                    <Button
                        key={account.id}
                        variant={selected?.id === account.id ? "default" : "outline"}
                        size="sm"
                        render={
                            <Link href={`/dashboard/template?account=${account.id}`}>
                                <span className="truncate">{account.name ?? t("unnamedAccount")}</span>
                                {account.report_template && (
                                    <Badge variant="secondary" className="ml-1">
                                        {t("custom")}
                                    </Badge>
                                )}
                            </Link>
                        }
                    />
                ))}
            </div>

            {selected && (
                <div className="flex flex-row items-center gap-2">
                    <PlatformBadge platform={selected.connection.platform} />
                    <Typo as="muted" className="text-xs">
                        {selected.name ?? t("unnamedAccount")}
                    </Typo>
                </div>
            )}

            <TemplateScopeEditor
                adAccountId={selected?.id ?? null}
                initialBody={body}
                stored={stored}
                labels={{
                    scopeLabel: selected ? (selected.name ?? t("unnamedAccount")) : t("scopeDefault"),
                    scopeHelp: selected ? t("scopeAccountHelp") : t("scopeDefaultHelp"),
                    saved: t("saved"),
                    resetConfirm: t("resetConfirm"),
                }}
            />
        </div>
    );
}
