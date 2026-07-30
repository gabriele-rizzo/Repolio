"use server";

import { safeAction, type ActionResult } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { parseUtcDay } from "@/lib/date/start-of-day";
import { prisma } from "@/lib/prisma";
import { MAX_NDAYS, MIN_NDAYS } from "@/lib/recurrence/schedule";
import { revalidatePath } from "next/cache";

export interface ClientScheduleInput {
    clientId: number;
    /** Whole days between reports. */
    ndays: number;
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
export async function setClientSchedule({ clientId, ndays, startDate }: ClientScheduleInput): Promise<ActionResult> {
    return safeAction(async () => {
        // Server actions are public endpoints — gate independently of the admin layout UI.
        if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");

        if (!Number.isInteger(ndays) || ndays < MIN_NDAYS || ndays > MAX_NDAYS) {
            throw new Error(`Cadence must be a whole number of days between ${MIN_NDAYS} and ${MAX_NDAYS}.`);
        }

        const parsed = startDate == null ? null : parseUtcDay(startDate);
        if (startDate != null && parsed == null) throw new Error("That isn't a valid start date.");

        const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
        if (!client) throw new Error("That client no longer exists.");

        await prisma.recurrence.upsert({
            where: { client_id: clientId },
            create: { client_id: clientId, ndays, start_date: parsed },
            update: { ndays, start_date: parsed },
        });

        revalidatePath("/admin/schedule");
        revalidatePath("/dashboard/account");
    });
}
