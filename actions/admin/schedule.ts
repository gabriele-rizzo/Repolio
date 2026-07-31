"use server";

import { safeAction, type ActionResult } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { parseUtcDay } from "@/lib/date/start-of-day";
import { prisma } from "@/lib/prisma";
import {
    LAST_DAY_OF_MONTH,
    MAX_MONTH_INTERVAL,
    MAX_NDAYS,
    MIN_NDAYS,
    type RecurrenceMode,
} from "@/lib/recurrence/schedule";
import { revalidatePath } from "next/cache";

export interface ClientScheduleInput {
    clientId: number;
    /** INTERVAL counts days from the anchor; MONTHLY lands on a day of the calendar month. */
    mode: RecurrenceMode;
    /** Whole days between reports (INTERVAL). */
    ndays: number;
    /** Day of the calendar month, 1–31 where 31 means the last day (MONTHLY). */
    dayOfMonth: number;
    /** 1 = monthly, 3 = quarterly, 12 = yearly (MONTHLY). */
    monthInterval: number;
    /** Anchor as a "YYYY-MM-DD" day string, or null to clear it and fall back to the signup date. */
    startDate: string | null;
}

/**
 * Sets a client's report schedule from the admin side: cadence plus the anchor day that fixes which
 * weekday every report lands on (see lib/recurrence/schedule.ts).
 *
 * Clients can also change these from their own account settings, so whoever saved last wins — this is
 * not a lock. Past anchors are accepted deliberately: an anchor behind today defines the phase and
 * brings the client due once on the next cron run.
 */
export async function setClientSchedule({
    clientId,
    mode,
    ndays,
    dayOfMonth,
    monthInterval,
    startDate,
}: ClientScheduleInput): Promise<ActionResult> {
    return safeAction(async () => {
        // Server actions are public endpoints — gate independently of the admin layout UI.
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        if (mode !== "INTERVAL" && mode !== "MONTHLY") throw new Error("Unknown schedule mode.");

        if (!Number.isInteger(ndays) || ndays < MIN_NDAYS || ndays > MAX_NDAYS) {
            throw new Error(`Cadence must be a whole number of days between ${MIN_NDAYS} and ${MAX_NDAYS}.`);
        }
        if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > LAST_DAY_OF_MONTH) {
            throw new Error(`Day of month must be between 1 and ${LAST_DAY_OF_MONTH}.`);
        }
        if (!Number.isInteger(monthInterval) || monthInterval < 1 || monthInterval > MAX_MONTH_INTERVAL) {
            throw new Error(`Month interval must be between 1 and ${MAX_MONTH_INTERVAL}.`);
        }

        const parsed = startDate == null ? null : parseUtcDay(startDate);
        if (startDate != null && parsed == null) throw new Error("That isn't a valid start date.");

        const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
        if (!client) throw new Error("That client no longer exists.");

        const data = { mode, ndays, day_of_month: dayOfMonth, month_interval: monthInterval, start_date: parsed };

        await prisma.recurrence.upsert({
            where: { client_id: clientId },
            create: { client_id: clientId, ...data },
            update: data,
        });

        revalidatePath("/admin/schedule");
        revalidatePath("/dashboard/account");
    });
}
