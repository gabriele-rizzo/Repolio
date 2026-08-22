import { AccessRequests, type AccessRequestRow } from "@/components/admin/access-requests";
import { EnrollmentForm } from "@/components/forms/enrollment-form";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { prisma } from "@/lib/prisma";
import { attempt, failed } from "@/lib/try-catch";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

export const metadata: Metadata = {
    title: "Enrollment",
};

// Laid out like the rest of the admin section: page heading, then the work, then a list of what's
// already there. A server component so the lists are fetched here; only the form and the request
// buttons are interactive.
//
// Two ways in, in the order you'd act on them: requests that visitors filed themselves through
// /auth/register come first because someone is waiting on them, then the form for inviting a client
// nobody asked for. Both end in the same Supabase invite (lib/admin/invite.ts).

const RECENT_LIMIT = 8;
const REQUEST_LIMIT = 20;

export default async function EnrollmentPage() {
    const [locale, tDate] = await Promise.all([getLocale(), getTranslations("date")]);

    const [recent, total, pending] = await Promise.all([
        prisma.client.findMany({
            orderBy: { created_at: "desc" },
            take: RECENT_LIMIT,
            select: { id: true, name: true, email: true, company: true, created_at: true, account_id: true },
        }),
        prisma.client.count(),
        // Wrapped: AccessRequest is new, and migrations here are applied by hand, so this page has to
        // keep working on a deployment where the table does not exist yet. Enrolling a client manually
        // must not depend on the queue being readable.
        attempt(
            prisma.accessRequest.findMany({
                where: { status: "PENDING" },
                orderBy: { created_at: "asc" },
                take: REQUEST_LIMIT,
                select: { id: true, name: true, email: true, company: true, locale: true, created_at: true },
            }),
        ),
    ]);

    // Oldest first above: a queue is worked front to back, unlike the "recently enrolled" list below it.
    const requests: AccessRequestRow[] = failed(pending)
        ? []
        : pending.data.map((request) => ({
              id: request.id,
              name: request.name,
              email: request.email,
              company: request.company,
              locale: request.locale,
              createdLabel: dateFormatRelative(request.created_at, { locale, t: tDate }),
          }));

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Typo as="title">Enrollment</Typo>
                <Typo as="muted">
                    Invite a new client. They get an email to set a password, then connect their own ad accounts.
                </Typo>
            </div>

            {failed(pending) ? (
                <Card className="p-3">
                    <Typo as="muted" className="text-xs">
                        Access requests are unavailable — the AccessRequest migration has probably not been applied
                        yet. {pending.error}
                    </Typo>
                </Card>
            ) : (
                requests.length > 0 && <AccessRequests requests={requests} />
            )}

            <EnrollmentForm />

            {recent.length > 0 && (
                <div className="space-y-3 pt-2">
                    <div className="flex flex-row items-baseline justify-between gap-3">
                        <Typo as="large">Recently enrolled</Typo>
                        <Typo as="muted" className="text-xs">
                            {total} {total === 1 ? "client" : "clients"} total
                        </Typo>
                    </div>

                    <div className="space-y-2">
                        {recent.map((client) => (
                            <Card key={client.id} className="flex-row flex-wrap items-center justify-between gap-3 p-3">
                                <div className="min-w-0">
                                    <Typo as="normal" className="truncate text-sm font-medium">
                                        {client.name}
                                        {client.company && (
                                            <span className="text-muted-foreground"> · {client.company}</span>
                                        )}
                                    </Typo>
                                    <Typo as="muted" className="truncate text-xs">
                                        {client.email}
                                    </Typo>
                                </div>

                                <div className="flex shrink-0 flex-row items-center gap-2">
                                    {/* account_id is the Supabase auth user; it exists from the invite, so
                                        this reflects enrollment rather than whether they've signed in. */}
                                    <Badge variant="outline">#{client.id}</Badge>
                                    <Typo as="muted" className="text-xs">
                                        {dateFormatRelative(client.created_at, { locale, t: tDate })}
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
