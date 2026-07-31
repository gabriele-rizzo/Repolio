"use server";

import { authorize } from "@/actions/auth/authorize";
import { parseUtcDay, startOfUtcDay } from "@/lib/date/start-of-day";
import { prisma } from "@/lib/prisma";
import {
    DEFAULT_NDAYS,
    LAST_DAY_OF_MONTH,
    MAX_MONTH_INTERVAL,
    MAX_NDAYS,
    MIN_NDAYS,
    type RecurrenceMode,
} from "@/lib/recurrence/schedule";
import { revalidatePath } from "next/cache";

function revalidate() {
    revalidatePath("/dashboard/account");
    revalidatePath("/dashboard/reports");
}

export interface RecurrenceInput {
    /** INTERVAL counts days from the anchor; MONTHLY lands on a day of the calendar month. */
    mode: RecurrenceMode;
    /** Whole days between reports (INTERVAL). */
    ndays: number;
    /** Day of the calendar month, 1–31 where 31 means the last day (MONTHLY). */
    dayOfMonth: number;
    /** 1 = monthly, 3 = quarterly, 12 = yearly (MONTHLY). */
    monthInterval: number;
}

/** How often the client's reports are generated. */
export async function updateRecurrence({ mode, ndays, dayOfMonth, monthInterval }: RecurrenceInput) {
    if (mode !== "INTERVAL" && mode !== "MONTHLY") throw new Error("Unknown schedule mode.");
    if (!Number.isInteger(ndays) || ndays < MIN_NDAYS || ndays > MAX_NDAYS) {
        throw new Error(`Choose a cadence between ${MIN_NDAYS} and ${MAX_NDAYS} whole days.`);
    }
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > LAST_DAY_OF_MONTH) {
        throw new Error(`Choose a day between 1 and ${LAST_DAY_OF_MONTH}.`);
    }
    if (!Number.isInteger(monthInterval) || monthInterval < 1 || monthInterval > MAX_MONTH_INTERVAL) {
        throw new Error(`Choose an interval between 1 and ${MAX_MONTH_INTERVAL} months.`);
    }

    const client = await authorize();
    const data = { mode, ndays, day_of_month: dayOfMonth, month_interval: monthInterval };

    await prisma.recurrence.upsert({
        where: { client_id: client.id },
        create: { client_id: client.id, ...data },
        update: data,
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
