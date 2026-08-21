import { ClientPicker } from "@/components/admin/client-picker";
import { ScheduleForm } from "@/components/admin/schedule-form";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { toUtcDayString } from "@/lib/date/start-of-day";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { currentSlot, toSchedule, upcomingSlots } from "@/lib/recurrence/schedule";
import { CalendarClock, UsersRound } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Schedule",
};

// Where a client's report schedule is set: the cadence in days, plus the anchor day that decides which
// weekday every report lands on. Clients can change the same two values from their own account
// settings — this screen exists so the agency can set them, typically at onboarding.

const utcDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
    const { client: clientParam } = await searchParams;

    const clients = await prisma.client.findMany({
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            email: true,
            company: true,
            created_at: true,
            recurrence: {
                select: {
                    mode: true,
                    ndays: true,
                    start_date: true,
                    day_of_month: true,
                    month_interval: true,
                },
            },
        },
    });

    const clientId = clientParam ? Number(clientParam) : NaN;
    const selected = Number.isInteger(clientId) ? clients.find((c) => c.id === clientId) ?? null : null;

    const today = toUtcDayString(new Date());

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Typo as="title">Schedule</Typo>
                <Typo as="muted">
                    Set when a client&apos;s reports are generated: a start date for the first one, then a cadence in
                    days. Reports stay locked to the start date&apos;s weekday.
                </Typo>
            </div>

            <ClientPicker
                clients={clients.map(({ id, name, email, company }) => ({ id, name, email, company }))}
                selectedId={selected?.id ?? null}
                basePath="/admin/schedule"
            />

            {selected ? (
                <ScheduleForm
                    key={selected.id}
                    clientId={selected.id}
                    clientName={selected.name}
                    schedule={{
                        mode: selected.recurrence?.mode ?? "INTERVAL",
                        ndays: selected.recurrence?.ndays ?? 30,
                        dayOfMonth: selected.recurrence?.day_of_month ?? 1,
                        monthInterval: selected.recurrence?.month_interval ?? 1,
                    }}
                    startDate={selected.recurrence?.start_date ? toUtcDayString(selected.recurrence.start_date) : null}
                    today={today}
                    createdAt={toUtcDayString(selected.created_at)}
                />
            ) : (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <UsersRound />
                        </EmptyMedia>

                        <EmptyTitle>No client selected</EmptyTitle>
                        <EmptyDescription>Pick a client above to set their reporting schedule.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}

            <AllSchedules clients={clients} today={today} />
        </div>
    );
}

// An at-a-glance table of every client's schedule, so a misaligned or unset anchor is visible without
// clicking through each client.
async function AllSchedules({
    clients,
    today,
}: {
    clients: {
        id: number;
        name: string;
        company: string | null;
        created_at: Date;
        recurrence: {
            mode: string;
            ndays: number;
            start_date: Date | null;
            day_of_month: number;
            month_interval: number;
        } | null;
    }[];
    today: string;
}) {
    if (clients.length === 0) return null;

    // Last generated report per client, to show where each one actually stands against its schedule.
    // One grouped query rather than one per client — this table lists every client, so the previous
    // shape scaled its round trips with the roster.
    //
    // Deliberately NOT filtered to released reports: this mirrors due_clients(), which schedules on
    // generation time. A report awaiting validation has already consumed its slot.
    const lastReports =
        clients.length === 0
            ? []
            : await prisma.$queryRaw<{ client_id: number; last_report_at: Date }[]>`
                  SELECT pc.client_id, MAX(r.created_at) AS last_report_at
                  FROM "Report" r
                  JOIN "Snapshot" s ON s.report_id = r.id
                  JOIN "AdAccount" a ON a.id = s.ad_account_id
                  JOIN "PlatformConnection" pc ON pc.id = a.connection_id
                  WHERE pc.client_id IN (${Prisma.join(clients.map((c) => c.id))})
                  GROUP BY pc.client_id
              `;

    const lastByClient = new Map(lastReports.map((r) => [r.client_id, r.last_report_at]));

    const rows = clients.map((client) => {
        const schedule = toSchedule(client.recurrence, client.created_at);
        const anchored = client.recurrence?.start_date != null;
        const last = lastByClient.get(client.id) ?? null;

        const slot = currentSlot(schedule, utcDay(today));
        const next = upcomingSlots(schedule, utcDay(today), 1)[0];

        // Mirrors due_clients(): the current slot is reached and no report has been generated for it.
        const due = slot != null && (last == null || toUtcDayString(last) < toUtcDayString(slot));

        const cadence =
            schedule.mode === "MONTHLY"
                ? `${schedule.dayOfMonth === 31 ? "last day" : `day ${schedule.dayOfMonth}`} of every ${
                      schedule.monthInterval === 1 ? "month" : `${schedule.monthInterval} months`
                  }`
                : `every ${schedule.ndays} ${schedule.ndays === 1 ? "day" : "days"}`;

        return { client, cadence, anchored, anchor: schedule.anchor, next, due, last };
    });

    return (
        <div className="space-y-3 pt-2">
            <Typo as="large">All schedules</Typo>

            <div className="space-y-2">
                {rows.map(({ client, cadence, anchored, anchor, next, due, last }) => (
                    <Card key={client.id} className="flex-row flex-wrap items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                            <Typo as="normal" className="truncate text-sm font-medium">
                                {client.name}
                                {client.company && <span className="text-muted-foreground"> · {client.company}</span>}
                            </Typo>
                            <Typo as="muted" className="truncate text-xs">
                                {cadence} · from {toUtcDayString(anchor)}
                                {!anchored && " (signup — no start date set)"}
                            </Typo>
                        </div>

                        <div className="flex shrink-0 flex-row items-center gap-2">
                            {due && <Badge variant="destructive">Due now</Badge>}
                            {!anchored && <Badge variant="outline">Unanchored</Badge>}

                            <Badge variant="secondary" className="gap-1">
                                <CalendarClock />
                                {next
                                    ? next.toLocaleDateString("en-GB", {
                                          weekday: "short",
                                          day: "2-digit",
                                          month: "short",
                                          timeZone: "UTC",
                                      })
                                    : "—"}
                            </Badge>

                            <Typo as="muted" className="text-xs">
                                {last ? `last ${toUtcDayString(last)}` : "no reports yet"}
                            </Typo>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
