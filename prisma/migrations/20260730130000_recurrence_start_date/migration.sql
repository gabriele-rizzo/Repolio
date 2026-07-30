-- Anchored report schedules.
--
-- Adds `Recurrence.start_date` — the day a client's FIRST report is due — and rewrites due_clients()
-- to phase-lock every slot to it: reports fall on anchor + k × ndays.
--
-- Why phase-locking rather than "last report + ndays" (the previous rule): the old comparison measured
-- from whenever the last report happened, so a single late or retried run permanently shifted the
-- schedule — a Saturday client silently became a Sunday client. Now the cadence is measured from the
-- anchor, so the weekday is a property of the schedule instead of an accident of past run times.
--
-- The rule: a client is due when the current slot (the latest slot on or before today) has been
-- reached and no report has yet been generated for it. Comparing the last report against the SLOT, not
-- against today minus the cadence, gives two properties at once:
--   * a missed slot is still owed the next day, so a failed cron run never silently drops a report;
--   * catching up late does not move the following slot, which is still anchor + k × ndays.
-- An anchor in the past is legitimate and fires exactly once (for the latest reached slot), not once
-- per missed cycle.
--
-- start_date IS NULL keeps the historical anchor, c.created_at, so clients that never set one behave
-- as before. ndays is floored and clamped because the column is a Float. All comparisons are UTC
-- calendar days — Prisma stores timestamps as UTC wall-clock and snapshots key to UTC midnight.
--
-- Mirrored in TypeScript by lib/recurrence/schedule.ts (see lib/recurrence/schedule.test.ts). Changing
-- the rule here means changing it there.

-- AlterTable
ALTER TABLE "Recurrence" ADD COLUMN "start_date" TIMESTAMP(3);

CREATE OR REPLACE FUNCTION public.due_clients()
RETURNS SETOF "Client"
LANGUAGE sql
STABLE
AS $$
    SELECT c.*
    FROM "Client" c
    LEFT JOIN "Recurrence" rec ON rec.client_id = c.id
    -- Per-client schedule inputs, resolved once so the slot maths below stays readable.
    CROSS JOIN LATERAL (
        SELECT
            (now() AT TIME ZONE 'utc')::date AS today,
            COALESCE(rec.start_date, c.created_at)::date AS anchor,
            LEAST(365, GREATEST(1, floor(COALESCE(rec.ndays, 30))))::int AS step,
            (
                SELECT max(r.created_at)::date
                FROM "Report" r
                JOIN "Snapshot" s ON s.report_id = r.id
                JOIN "AdAccount" a ON a.id = s.ad_account_id
                JOIN "PlatformConnection" pc ON pc.id = a.connection_id
                WHERE pc.client_id = c.id
            ) AS last_report
    ) sched
    -- The latest slot on or before today; NULL until the anchor is reached. `date - date` is whole
    -- days and is non-negative here, so integer division truncates the same way floor() would.
    CROSS JOIN LATERAL (
        SELECT CASE
                   WHEN sched.today < sched.anchor THEN NULL
                   ELSE sched.anchor + (((sched.today - sched.anchor) / sched.step) * sched.step)
               END AS current_slot
    ) slot
    WHERE c.active
      AND slot.current_slot IS NOT NULL
      AND (sched.last_report IS NULL OR sched.last_report < slot.current_slot);
$$;

GRANT EXECUTE ON FUNCTION public.due_clients() TO service_role;
