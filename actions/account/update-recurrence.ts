"use server";

import { authorize } from "@/actions/auth/authorize";
import { parseUtcDay, startOfUtcDay } from "@/lib/date/start-of-day";
import { prisma } from "@/lib/prisma";
import { DEFAULT_NDAYS, MAX_NDAYS, MIN_NDAYS } from "@/lib/recurrence/schedule";
import { revalidatePath } from "next/cache";

function revalidate() {
    revalidatePath("/dashboard/account");
    revalidatePath("/dashboard/reports");
}

/** How often the client's reports are generated, in whole days. */
export async function updateRecurrence(ndays: number) {
    if (!Number.isInteger(ndays) || ndays < MIN_NDAYS || ndays > MAX_NDAYS) {
        throw new Error(`Choose a cadence between ${MIN_NDAYS} and ${MAX_NDAYS} whole days.`);
    }

    const client = await authorize();

    await prisma.recurrence.upsert({
        where: { client_id: client.id },
        create: { client_id: client.id, ndays },
        update: { ndays },
    });

    revalidate();
}

/**
 * The anchor day for the client's schedule: the day their first report is due, which also fixes the
 * weekday every later report lands on (see lib/recurrence/schedule.ts).
 *
 * `startDate` is a "YYYY-MM-DD" day string, or null to clear the anchor and fall back to the client's
 * signup date.
 *
 * Clients may only anchor to a FUTURE day. A past-or-today anchor immediately satisfies "the current
 * slot has been reached", so allowing one here would let a client generate a report on demand — and
 * repeatedly, by nudging the date each day — spending AI tokens per call. The admin action
 * (`actions/admin/schedule.ts`) accepts any date, including past ones, because backdating an anchor to
 * fix a client's phase is a legitimate operator task.
 */
export async function updateRecurrenceStart(startDate: string | null) {
    const parsed = startDate == null ? null : parseUtcDay(startDate);
    if (startDate != null && parsed == null) throw new Error("That isn't a valid date.");

    if (parsed && parsed.getTime() <= startOfUtcDay(new Date()).getTime()) {
        throw new Error("Pick a future date — a report schedule can only start from tomorrow onwards.");
    }

    const client = await authorize();

    await prisma.recurrence.upsert({
        where: { client_id: client.id },
        create: { client_id: client.id, ndays: DEFAULT_NDAYS, start_date: parsed },
        update: { start_date: parsed },
    });

    revalidate();
}
