import type { PhaseCounts } from "@/lib/cron/run-record";

// Reads one phase's counts back out of `CronRun.detail`.
//
// WHY THIS EXISTS: for the combined `daily` job the top-level CronRun counts describe the SNAPSHOT
// phase only — the report phase's counts live in `detail.poll` (see app/api/cron/daily/route.ts).
// On 2026-09-01 the Anthropic batch submit failed with "credit balance is too low", so a client's 54
// report narratives were all left empty; the run still recorded considered=2 processed=2 failed=0 at
// the top level and /admin/health rendered it as a clean "ok". The only trace anywhere was one
// SyncError row. A green health page beside a silently broken report phase is precisely the failure
// mode that page exists to catch, so the detail has to be READ, not merely stored.
//
// `detail` is deliberately free-form JSON ("a new phase needs no migration"), which means rows
// predate any given key and a future shape may not match at all. Every field is therefore validated
// rather than cast: an unreadable detail returns null — rendered as "—" — and never a confident zero,
// because "this phase ran no work" and "we could not tell" must not look the same on a health page.

const PHASE_KEYS = ["considered", "processed", "failed", "skipped"] as const;

/** A finite number, or 0. Guards against nulls and the strings a hand-edited JSON column can hold. */
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The counts recorded for `phase` in a run's `detail`, or null when the row carries none.
 *
 * `detail` is typed `unknown` rather than Prisma's JsonValue so this stays usable from anywhere
 * (and testable without the generated client).
 */
export function phaseCounts(detail: unknown, phase: string): PhaseCounts | null {
    if (!isRecord(detail)) return null;

    const raw = detail[phase];
    if (!isRecord(raw)) return null;

    // At least one recognisable key. Without this, any object that happens to sit under the phase
    // name (`budget_ms`-style scalars aside, a future `poll: { reason: "..." }`) would report
    // 0/0/0/0 — an unrun phase reading as a healthy one, the exact confusion this function prevents.
    if (!PHASE_KEYS.some((key) => typeof raw[key] === "number")) return null;

    return {
        considered: count(raw.considered),
        processed: count(raw.processed),
        failed: count(raw.failed),
        skipped: count(raw.skipped),
    };
}
