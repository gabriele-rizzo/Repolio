// Finding the days an account's snapshot history is WRONG, so a recovery re-pull can target them.
//
// WHY THIS IS NEEDED AT ALL: the daily pipeline already self-heals one of the two ways a Zernio
// outage damages history, and cannot see the other.
//
//   1. The fetch FAILED (throw / non-2xx — the Zernio billing lapse of Aug 2026). Nothing was
//      written, so `Snapshot.start_date` still tops out at the last good day, and the next run's
//      window is `min(last recorded day, trailing floor)` — it stretches back over the whole gap on
//      its own (see fetch-snapshot.ts). A plain re-run recovers this; no window has to be stored.
//
//   2. The fetch SUCCEEDED WITH NO ROWS. Zernio answers 200 with `rows: []` for an account it won't
//      serve data for, which is indistinguishable from a genuine zero-delivery day — so zero-fill
//      wrote explicit all-zero rows across the trailing window (see zero-fill.ts). Those rows ADVANCE
//      the newest recorded day, so tomorrow's trailing window starts after them and never looks back.
//      The fake zeros are frozen, no SyncError was ever logged, and /admin/health reads clean while
//      every report over the period narrates a spend collapse that did not happen.
//
// Case 2 is why this module keys off the DATA rather than off the SyncError log: an error row is
// evidence a fetch failed, never evidence that what landed is correct. Driving recovery off observed
// history also makes it self-verifying — a healed day stops being reported, with no resolved-flag
// bookkeeping to drift out of sync with reality.
//
// Pure and dependency-light (day strings and numbers, no Prisma, no Date arithmetic beyond DAY_MS) so
// it unit-tests without the app or the database.

import { DAY_MS } from "@/lib/constants";

/** A contiguous, inclusive run of UTC calendar days, as "YYYY-MM-DD" wire strings. */
export interface DayRange {
    from: string;
    to: string;
    /** Days in the range, inclusive of both ends. */
    days: number;
}

/** One day of an account's stored history, reduced to what damage detection needs. */
export interface HistoryDay {
    /** UTC calendar day, "YYYY-MM-DD". */
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
}

const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const dayMs = (date: string): number => Date.parse(`${date}T00:00:00.000Z`);

/** Inclusive day count between two day strings. */
const spanDays = (from: string, to: string): number => Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1;

/**
 * Collapses a sorted list of day strings into contiguous inclusive ranges.
 *
 * Ranges rather than a flat day list because that is what a re-pull wants: one Zernio timeline call
 * covers a whole range, and a 40-day outage is one request, not 40.
 */
export function toRanges(days: string[]): DayRange[] {
    if (days.length === 0) return [];

    const sorted = [...new Set(days)].sort();
    const ranges: DayRange[] = [];
    let start = sorted[0];
    let previous = sorted[0];

    for (const day of sorted.slice(1)) {
        // Adjacent to the run we're accumulating? Extend it. Otherwise close it and start over.
        if (dayMs(day) - dayMs(previous) === DAY_MS) {
            previous = day;
            continue;
        }
        ranges.push({ from: start, to: previous, days: spanDays(start, previous) });
        start = day;
        previous = day;
    }

    ranges.push({ from: start, to: previous, days: spanDays(start, previous) });
    return ranges;
}

/**
 * UTC days in `[from, to]` with no stored row at all — failure mode 1.
 *
 * Bounded by the caller to the account's own history: a day before the account's first-ever snapshot
 * is not a gap, it is a day the account did not exist for us yet, and treating it as one would ask
 * Zernio to re-pull the entire backfill horizon on every scan.
 */
export function missingDays(have: Set<string>, from: string, to: string): DayRange[] {
    const end = dayMs(to);
    const out: string[] = [];

    for (let t = dayMs(from); t <= end; t += DAY_MS) {
        const day = ymd(t);
        if (!have.has(day)) out.push(day);
    }

    return toRanges(out);
}

/** A day with no measured activity whatsoever — the shape zero-fill synthesizes. */
const isZeroDay = (day: HistoryDay): boolean =>
    day.spend === 0 && day.impressions === 0 && day.clicks === 0 && day.conversions === 0;

/**
 * Minimum consecutive all-zero days before a run is worth an admin's attention.
 *
 * A single zero day is ordinary — a paused campaign, an exhausted budget, a weekend on a
 * business-hours schedule — and reporting those would bury the real outage in noise. Three or more in
 * a row on an account that was otherwise spending is the signature of failure mode 2, because
 * zero-fill synthesizes across the whole trailing re-pull window (3 days, 7 on a reconcile Monday) at
 * once rather than one isolated day.
 */
export const MIN_ZERO_RUN = 3;

/**
 * Runs of consecutive stored all-zero days — the candidates for failure mode 2.
 *
 * SUSPICIOUS, NOT PROVEN. A genuinely paused account produces exactly this, and nothing in the stored
 * row distinguishes "Zernio served no rows" from "there was no delivery" — that information was lost
 * the moment zero-fill wrote the row. So this narrows where to look; only a re-pull settles it, which
 * is why the recovery re-pull is non-destructive (it upserts what Zernio returns and leaves a day
 * alone when Zernio confirms the zero).
 *
 * `requireSpendBefore` is what keeps the noise down: a run is only reported if the account was
 * actually spending at some point BEFORE it, so a never-active or long-retired account doesn't
 * surface its whole dormant history. Gated on days strictly before the run, so the run itself can't
 * vouch for itself.
 */
export function zeroRuns(history: HistoryDay[], minRun = MIN_ZERO_RUN, requireSpendBefore = true): DayRange[] {
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const runs: DayRange[] = [];

    let spentEarlier = false;
    let run: HistoryDay[] = [];

    const close = () => {
        // `spentEarlier` is read at close time but only ever set by days preceding the run, since a
        // zero day by definition adds no spend — so the run cannot qualify itself.
        if (run.length >= minRun && (!requireSpendBefore || spentEarlier)) {
            const from = run[0].date;
            const to = run[run.length - 1].date;
            runs.push({ from, to, days: spanDays(from, to) });
        }
        run = [];
    };

    for (const day of sorted) {
        if (isZeroDay(day)) {
            // A hole in the stored history breaks the run: those missing days are failure mode 1 and
            // are reported by missingDays(). Merging across them would double-report the same outage
            // and overstate how long the zero run actually is.
            const previous = run[run.length - 1];
            if (previous && dayMs(day.date) - dayMs(previous.date) !== DAY_MS) close();
            run.push(day);
            continue;
        }

        close();
        if (day.spend > 0) spentEarlier = true;
    }

    close();
    return runs;
}

/**
 * Widens `ranges` by `padDays` on each side and merges any that then touch or overlap.
 *
 * A re-pull is padded because the boundary days of a damaged window are the least trustworthy ones:
 * an outage that began mid-day leaves a partially-populated row on each edge, which is stored, so it
 * reads as present-and-fine to missingDays(). Re-pulling one extra day either side costs nothing (the
 * upsert is idempotent) and is the difference between healing the outage and healing all but its
 * first and last day.
 */
export function padRanges(ranges: DayRange[], padDays: number): DayRange[] {
    if (ranges.length === 0) return [];

    const padded = ranges
        .map((range) => ({
            from: ymd(dayMs(range.from) - padDays * DAY_MS),
            to: ymd(dayMs(range.to) + padDays * DAY_MS),
        }))
        .sort((a, b) => a.from.localeCompare(b.from));

    const merged: DayRange[] = [];
    let current = padded[0];

    for (const range of padded.slice(1)) {
        // Touching counts as overlapping: two ranges a day apart are one request, not two.
        if (dayMs(range.from) <= dayMs(current.to) + DAY_MS) {
            if (dayMs(range.to) > dayMs(current.to)) current = { from: current.from, to: range.to };
            continue;
        }
        merged.push({ ...current, days: spanDays(current.from, current.to) });
        current = range;
    }

    merged.push({ ...current, days: spanDays(current.from, current.to) });
    return merged;
}

/** Total days covered by a set of ranges — what the UI reports as the size of the damage. */
export const totalDays = (ranges: DayRange[]): number => ranges.reduce((sum, r) => sum + r.days, 0);
