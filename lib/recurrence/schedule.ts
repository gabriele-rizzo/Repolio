import { DAY_MS } from "@/lib/constants";
import { startOfUtcDay } from "@/lib/date/start-of-day";

/**
 * Report scheduling. Two shapes, both phase-locked so the schedule can't drift:
 *
 *  - INTERVAL — every `ndays`, counted from the anchor. Anchor a client to a Saturday and their
 *    reports stay on Saturdays. Covers weekly/fortnightly/any-N-days.
 *  - MONTHLY — calendar-aligned: day `dayOfMonth` of every `monthInterval` months ("the 1st",
 *    "the 15th", "quarterly on the 1st"). Interval mode can't express this, because months are not a
 *    whole number of days: 30-day steps from 1 January land on 31 January, then 2 March.
 *
 * A cron run that fails or lands late does NOT shift either schedule: the missed slot is still owed
 * (so no report is silently lost), and the slot after it is still computed from the anchor/calendar.
 *
 * This module is the TypeScript twin of the `due_clients()` SQL function
 * (prisma/migrations/20260730170000_recurrence_monthly). The cron selects due clients through the
 * SQL; the UI previews upcoming dates through here. They must agree — if you change the rule in one,
 * change it in the other, and the tests in schedule.test.ts pin the shared behaviour.
 *
 * Everything is UTC calendar-day arithmetic. Snapshots key their start_date to UTC midnight and the
 * SQL compares on UTC dates, so day math anywhere near scheduling has to be UTC too.
 */

export const DEFAULT_NDAYS = 30;
export const MIN_NDAYS = 1;
export const MAX_NDAYS = 365;

/** 31 means "last day of the month": every day-of-month is clamped to the month's length. */
export const LAST_DAY_OF_MONTH = 31;
export const MAX_MONTH_INTERVAL = 12;

export type RecurrenceMode = "INTERVAL" | "MONTHLY";

export interface Schedule {
    mode: RecurrenceMode;
    /** start_date, or the client's created_at when they never set one. Fixes the phase. */
    anchor: Date;
    /** INTERVAL only. */
    ndays: number;
    /** MONTHLY only: 1–31, where 31 lands on the last day of every month. */
    dayOfMonth: number;
    /** MONTHLY only: 1 = monthly, 3 = quarterly, 12 = yearly. */
    monthInterval: number;
}

/** Whole UTC days from `a` to `b` (negative when b precedes a). */
export function daysBetween(a: Date, b: Date): number {
    return Math.round((startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / DAY_MS);
}

/** `date` shifted by whole UTC days. */
export function addDays(date: Date, days: number): Date {
    return new Date(startOfUtcDay(date).getTime() + days * DAY_MS);
}

/**
 * A cadence clamped to whole days in [MIN_NDAYS, MAX_NDAYS]. `Recurrence.ndays` is a Float column, so
 * a fractional or out-of-range value is possible in the data; this mirrors the SQL's
 * `LEAST(365, GREATEST(1, floor(ndays)))` so both sides land on the same integer.
 */
export function normalizeNdays(ndays: number | null | undefined): number {
    if (ndays == null || !Number.isFinite(ndays)) return DEFAULT_NDAYS;
    return Math.min(MAX_NDAYS, Math.max(MIN_NDAYS, Math.floor(ndays)));
}

export function normalizeDayOfMonth(day: number | null | undefined): number {
    if (day == null || !Number.isFinite(day)) return 1;
    return Math.min(LAST_DAY_OF_MONTH, Math.max(1, Math.floor(day)));
}

export function normalizeMonthInterval(months: number | null | undefined): number {
    if (months == null || !Number.isFinite(months)) return 1;
    return Math.min(MAX_MONTH_INTERVAL, Math.max(1, Math.floor(months)));
}

/** Builds a normalised Schedule from raw Recurrence columns. */
export function toSchedule(row: {
    mode?: string | null;
    start_date?: Date | null;
    ndays?: number | null;
    day_of_month?: number | null;
    month_interval?: number | null;
} | null | undefined, fallbackAnchor: Date): Schedule {
    return {
        mode: row?.mode === "MONTHLY" ? "MONTHLY" : "INTERVAL",
        anchor: startOfUtcDay(row?.start_date ?? fallbackAnchor),
        ndays: normalizeNdays(row?.ndays),
        dayOfMonth: normalizeDayOfMonth(row?.day_of_month),
        monthInterval: normalizeMonthInterval(row?.month_interval),
    };
}

/** Whole months between two dates, ignoring the day of month. */
function monthsBetween(a: Date, b: Date): number {
    return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/**
 * The monthly slot `k` months after the anchor's month.
 *
 * `dayOfMonth` is clamped to the length of that specific month, which is what makes "the 31st" mean
 * the last day everywhere and stops "the 30th" from silently skipping February.
 */
export function monthlySlot(anchor: Date, k: number, dayOfMonth: number): Date {
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth() + k;

    // Day 0 of the following month is the last day of this one; Date.UTC normalises the overflow.
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(normalizeDayOfMonth(dayOfMonth), daysInMonth)));
}

/**
 * The most recent scheduled slot on or before `today`, or null when the schedule hasn't produced one
 * yet. A past anchor is legitimate: it fixes the phase, and the slot returned is the latest one
 * already reached — never a backlog of every missed slot since.
 */
export function currentSlot(schedule: Schedule, today: Date): Date | null {
    const { mode, anchor } = schedule;
    const day = startOfUtcDay(today);
    if (daysBetween(anchor, day) < 0) return null;

    if (mode === "INTERVAL") {
        const step = normalizeNdays(schedule.ndays);
        return addDays(anchor, Math.floor(daysBetween(anchor, day) / step) * step);
    }

    const months = normalizeMonthInterval(schedule.monthInterval);
    // Align down to the interval, then consider that slot and the one before it: the aligned month's
    // slot can still be in the future (today is the 5th, the slot is the 15th).
    const aligned = Math.floor(monthsBetween(anchor, day) / months) * months;

    const candidates = [aligned, aligned - months]
        .map((k) => monthlySlot(anchor, k, schedule.dayOfMonth))
        // A slot before the anchor doesn't count: the schedule starts there. Anchoring on 10 August
        // with "the 1st" means the first report is 1 September, not 1 August.
        .filter((slot) => slot <= day && slot >= anchor);

    return candidates.length > 0 ? new Date(Math.max(...candidates.map((d) => d.getTime()))) : null;
}

/** The next `count` slots falling on or after `from`, in ascending order. */
export function upcomingSlots(schedule: Schedule, from: Date, count: number): Date[] {
    const wanted = Math.max(0, count);
    if (wanted === 0) return [];

    const start = startOfUtcDay(from);
    const { anchor } = schedule;

    if (schedule.mode === "INTERVAL") {
        const step = normalizeNdays(schedule.ndays);
        const elapsed = daysBetween(anchor, start);
        const firstIndex = elapsed <= 0 ? 0 : Math.ceil(elapsed / step);

        return Array.from({ length: wanted }, (_, i) => addDays(anchor, (firstIndex + i) * step));
    }

    const months = normalizeMonthInterval(schedule.monthInterval);
    // Step back one interval before walking forward: the aligned month's slot may already have passed.
    let k = Math.max(0, Math.floor(monthsBetween(anchor, start) / months) * months) - months;

    const slots: Date[] = [];
    // Bounded so a pathological input can't spin: each step advances by at least one month.
    for (let guard = 0; slots.length < wanted && guard < wanted + 4; guard += 1, k += months) {
        const slot = monthlySlot(anchor, k, schedule.dayOfMonth);
        if (slot >= start && slot >= anchor) slots.push(slot);
    }

    return slots;
}

/**
 * Whether a client is due for a report today — the rule `due_clients()` implements.
 *
 * Due when the current slot has been reached and no report has been generated for it yet. Comparing
 * the last report against the *slot* (rather than against today minus the cadence) is what makes the
 * schedule drift-proof: a report generated a day late still satisfies its own slot, and the next slot
 * is measured from the anchor/calendar regardless.
 *
 * `lastReportDay` is null for a client that has never had a report.
 */
export function isDue(schedule: Schedule, today: Date, lastReportDay: Date | null): boolean {
    const slot = currentSlot(schedule, today);
    if (!slot) return false;

    return lastReportDay == null || daysBetween(lastReportDay, slot) > 0;
}
