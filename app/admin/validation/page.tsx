import {
    ValidationBatches,
    type ReportAiStatus,
    type ValidationBatchCard,
} from "@/components/admin/validation-batches";
import type { Recommendation } from "@/components/report/recommendation-card";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { prisma } from "@/lib/prisma";
import { MailCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Validation | Repolio",
};

// Nothing is delivered to a client until it passes through here. The cron generates each client's
// reports into an unsent ReportBatch; this screen is where an admin reads them, drops any that
// shouldn't go out, and releases the rest with ONE email per client.

const SENT_HISTORY = 5;

export default async function ValidationPage() {
    const [pendingBatches, sentBatches] = await Promise.all([
        prisma.reportBatch.findMany({
            where: { sent_at: null },
            // Oldest first: a batch that has been waiting longest is the one to deal with.
            orderBy: { created_at: "asc" },
            select: {
                id: true,
                created_at: true,
                client: { select: { name: true, email: true, company: true } },
                reports: {
                    orderBy: { id: "asc" },
                    select: {
                        id: true,
                        approved: true,
                        ai_pending: true,
                        trend_explanation: true,
                        recommendations: true,
                        snapshots: {
                            orderBy: { start_date: "asc" },
                            select: { start_date: true, ad_account_id: true },
                        },
                    },
                },
            },
        }),
        prisma.reportBatch.findMany({
            where: { sent_at: { not: null } },
            orderBy: { sent_at: "desc" },
            take: SENT_HISTORY,
            select: {
                id: true,
                sent_at: true,
                client: { select: { name: true, email: true } },
                _count: { select: { reports: true } },
                reports: { where: { approved: true }, select: { id: true } },
            },
        }),
    ]);

    // One lookup for every account referenced across every pending batch.
    const accountIds = [
        ...new Set(pendingBatches.flatMap((b) => b.reports.flatMap((r) => r.snapshots.map((s) => s.ad_account_id)))),
    ];
    const accountRows = accountIds.length
        ? await prisma.adAccount.findMany({
              where: { id: { in: accountIds } },
              select: { id: true, name: true, connection: { select: { platform: true } } },
          })
        : [];
    const accounts = new Map(accountRows.map((a) => [a.id, a]));

    const batches: ValidationBatchCard[] = pendingBatches.map((batch) => ({
        id: batch.id,
        clientName: batch.client.name,
        clientEmail: batch.client.email,
        company: batch.client.company,
        createdLabel: dateFormatRelative(batch.created_at),
        reports: batch.reports.map((report) => {
            const first = report.snapshots[0];
            const account = first ? accounts.get(first.ad_account_id) : undefined;
            const recommendations = (report.recommendations ?? []) as unknown as Recommendation[];

            // EMPTY covers both intended cases (a zero-activity period, which never calls the model)
            // and a failed generation — either way the PDF goes out with no AI section, which is the
            // thing an admin needs to see before approving.
            const status: ReportAiStatus = report.ai_pending
                ? "GENERATING"
                : report.trend_explanation || recommendations.length > 0
                  ? "READY"
                  : "EMPTY";

            return {
                id: report.id,
                accountName: account?.name ?? `Account #${first?.ad_account_id ?? "?"}`,
                platform: account?.connection.platform ?? null,
                period: first
                    ? `${dateFormatRelative(first.start_date)} – ${dateFormatRelative(
                          report.snapshots.at(-1)?.start_date ?? first.start_date,
                      )}`
                    : "No period",
                days: report.snapshots.length,
                status,
                recommendationCount: recommendations.length,
                approved: report.approved,
            };
        }),
    }));

    const totalPending = batches.reduce((sum, b) => sum + b.reports.length, 0);

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Typo as="title">Validation</Typo>
                <Typo as="muted">
                    Reports wait here until you approve them — clients can&apos;t see anything on this page yet.
                    Validating a batch sends that client one email with every approved report attached as a PDF. If a
                    write-up reads wrong, fix the account context or template and hit Regenerate: the numbers and the
                    period stay exactly as they are, only the AI section is rewritten.
                </Typo>
            </div>

            {batches.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <MailCheck />
                        </EmptyMedia>

                        <EmptyTitle>Nothing to validate</EmptyTitle>
                        <EmptyDescription>
                            Every generated report has been reviewed and sent. New batches appear here after the report
                            cron runs.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <Typo as="muted" className="text-xs">
                        {batches.length} {batches.length === 1 ? "client batch" : "client batches"} · {totalPending}{" "}
                        {totalPending === 1 ? "report" : "reports"} awaiting validation
                    </Typo>

                    <ValidationBatches batches={batches} />
                </>
            )}

            {sentBatches.length > 0 && (
                <div className="space-y-3 pt-2">
                    <Typo as="large">Recently sent</Typo>

                    <div className="space-y-2">
                        {sentBatches.map((batch) => (
                            <Card key={batch.id} className="flex-row items-center justify-between gap-3 p-3">
                                <div className="min-w-0">
                                    <Typo as="normal" className="truncate text-sm font-medium">
                                        {batch.client.name}
                                    </Typo>
                                    <Typo as="muted" className="truncate text-xs">
                                        {batch.client.email}
                                    </Typo>
                                </div>

                                <div className="flex shrink-0 flex-row items-center gap-2">
                                    <Badge variant="secondary">
                                        {batch.reports.length}/{batch._count.reports} sent
                                    </Badge>
                                    <Typo as="muted" className="text-xs">
                                        {batch.sent_at ? dateFormatRelative(batch.sent_at) : ""}
                                    </Typo>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
