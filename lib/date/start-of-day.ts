export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// UTC variant. Snapshots key their start_date to UTC midnight (see fetch-snapshot) and the
// due_clients() RPC compares on UTC days, so day math in the crons must also be UTC.
export function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Parses a "YYYY-MM-DD" day string to UTC midnight, or null if it isn't one.
 *
 * Calendar days cross the wire as day strings, never as instants: `new Date("2026-08-01")` is already
 * UTC midnight, but sending a Date through a server action and re-reading it in another timezone is
 * how an anchor silently becomes the day before. Strict about the shape so a half-typed date in an
 * input can't be stored as a real one.
 */
export function parseUtcDay(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    // Rejects overflow like 2026-02-31, which Date would roll forward into March.
    return date.toISOString().slice(0, 10) === value ? date : null;
}

/** A Date's UTC calendar day as "YYYY-MM-DD" — the wire form for anchors. */
export function toUtcDayString(date: Date): string {
    return date.toISOString().slice(0, 10);
}
