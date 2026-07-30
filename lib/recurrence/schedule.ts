import { DAY_MS } from "@/lib/constants";
import { startOfUtcDay } from "@/lib/date/start-of-day";

/**
 * Report scheduling: a cadence in days plus an anchor date ("the first report lands on this day").
 *
 * Slots are phase-locked to the anchor — every one falls on `anchor + k × ndays`, so a client anchored
 * to a Saturday is reported on Saturdays forever. A cron run that fails or lands late does NOT shift
 * the schedule: the missed slot is still owed (so no report is silently lost), and the slot after it is
 * still computed from the anchor, so the weekday recovers on its own.
 *
 * This module is the TypeScript twin of the `due_clients()` SQL function
 * (prisma/migrations/20260730130000_recurrence_start_date). The cron selects due clients through the
 * SQL; the UI previews upcoming dates through here. They must agree — if you change the rule in one,
 * change it in the other, and the tests in schedule.test.ts pin the shared behaviour.
 *
 * Everything is UTC calendar-day arithmetic. Snapshots key their start_date to UTC midnight and the
 * SQL compares on UTC dates, so day math anywhere near scheduling has to be UTC too.
 */

export const DEFAULT_NDAYS = 30;
export const MIN_NDAYS = 1;
export const MAX_NDAYS = 365;

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

/**
 * The most recent scheduled slot on or before `today`, or null when the schedule hasn't started yet
 * (`today` precedes the anchor). A past anchor is legitimate: it just fixes the phase, and the slot
 * returned is the latest one already reached — never a backlog of every missed slot since.
 */
export function currentSlot(anchor: Date, ndays: number, today: Date): Date | null {
    const elapsed = daysBetween(anchor, today);
    if (elapsed < 0) return null;

    const step = normalizeNdays(ndays);
    return addDays(anchor, Math.floor(elapsed / step) * step);
}

/** The next `count` slots falling on or after `from`, in ascending order. */
export function upcomingSlots(anchor: Date, ndays: number, from: Date, count: number): Date[] {
    const step = normalizeNdays(ndays);
    const elapsed = daysBetween(anchor, from);
    // Before the anchor, the schedule simply starts at the anchor.
    const firstIndex = elapsed <= 0 ? 0 : Math.ceil(elapsed / step);

    return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(anchor, (firstIndex + i) * step));
}

/**
 * Whether a client is due for a report today — the rule `due_clients()` implements.
 *
 * Due when the current slot has been reached and no report has been generated for it yet. Comparing
 * the last report against the *slot* (rather than against today minus the cadence) is what makes the
 * schedule drift-proof: a report generated a day late still satisfies its own slot, and the next slot
 * is measured from the anchor regardless.
 *
 * `lastReportDay` is null for a client that has never had a report.
 */
export function isDue(anchor: Date, ndays: number, today: Date, lastReportDay: Date | null): boolean {
    const slot = currentSlot(anchor, ndays, today);
    if (!slot) return false;

    return lastReportDay == null || daysBetween(lastReportDay, slot) > 0;
}
