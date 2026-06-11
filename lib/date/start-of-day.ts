export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// UTC variant. Snapshots key their start_date to UTC midnight (see fetch-snapshot) and the
// due_clients() RPC compares on UTC days, so day math in the crons must also be UTC.
export function startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
