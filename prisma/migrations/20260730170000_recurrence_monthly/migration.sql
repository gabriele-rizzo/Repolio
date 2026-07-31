-- Calendar-aligned report schedules ("the 1st of the month").
--
-- Interval mode phase-locks to a day count, which cannot express a calendar rule: 30-day steps from
-- 1 January land on 31 January, then 2 March. MONTHLY adds day-of-month scheduling with a month
-- interval (1 = monthly, 3 = quarterly, 12 = yearly).
--
-- Existing rows default to INTERVAL, so every current schedule keeps behaving exactly as before.
--
-- Mirrored in TypeScript by lib/recurrence/schedule.ts (see lib/recurrence/schedule.test.ts).
-- Changing the rule here means changing it there.

-- CreateEnum
CREATE TYPE "RecurrenceMode" AS ENUM ('INTERVAL', 'MONTHLY');

-- AlterTable
ALTER TABLE "Recurrence"
    ADD COLUMN "mode" "RecurrenceMode" NOT NULL DEFAULT 'INTERVAL',
    ADD COLUMN "day_of_month" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "month_interval" INTEGER NOT NULL DEFAULT 1;

-- The monthly slot `k` months after the anchor's month.
--
-- day_of_month is clamped to the length of that specific month, which is what makes 31 mean "the last
-- day" everywhere and stops "the 30th" from silently skipping February. Date arithmetic only, so it is
-- IMMUTABLE and usable anywhere in a query.
CREATE OR REPLACE FUNCTION public.monthly_slot(anchor date, k int, day_of_month int)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (
        m + (
            LEAST(
                GREATEST(day_of_month, 1),
                -- Day 0 of the next month is the last day of this one.
                EXTRACT(DAY FROM (m + INTERVAL '1 month - 1 day'))::int
            ) - 1
        )
    )::date
    FROM (SELECT (date_trunc('month', anchor::timestamp) + make_interval(months => k))::date AS m) month_start;
$$;

-- Rewritten due_clients(): same rule as before ("the current slot has been reached and no report has
-- been generated for it"), now with two ways of computing that slot.
CREATE OR REPLACE FUNCTION public.due_clients()
RETURNS SETOF "Client"
LANGUAGE sql
STABLE
AS $$
    SELECT c.*
    FROM "Client" c
    LEFT JOIN "Recurrence" rec ON rec.client_id = c.id
    -- Per-client schedule inputs, resolved once so the slot maths below stays readable. Every value is
    -- clamped exactly as normalizeNdays / normalizeDayOfMonth / normalizeMonthInterval do in TS.
    CROSS JOIN LATERAL (
        SELECT
            (now() AT TIME ZONE 'utc')::date AS today,
            COALESCE(rec.start_date, c.created_at)::date AS anchor,
            COALESCE(rec.mode, 'INTERVAL'::"RecurrenceMode") AS mode,
            LEAST(365, GREATEST(1, floor(COALESCE(rec.ndays, 30))))::int AS step,
            LEAST(31, GREATEST(1, COALESCE(rec.day_of_month, 1)))::int AS dom,
            LEAST(12, GREATEST(1, COALESCE(rec.month_interval, 1)))::int AS months,
            (
                SELECT max(r.created_at)::date
                FROM "Report" r
                JOIN "Snapshot" s ON s.report_id = r.id
                JOIN "AdAccount" a ON a.id = s.ad_account_id
                JOIN "PlatformConnection" pc ON pc.id = a.connection_id
                WHERE pc.client_id = c.id
            ) AS last_report
    ) sched
    -- Whole months from the anchor's month to today's, then aligned down to the interval. Guaranteed
    -- non-negative wherever it is used (today < anchor short-circuits to NULL below), so integer
    -- division truncates the same way TS's Math.floor does.
    CROSS JOIN LATERAL (
        SELECT
            (EXTRACT(YEAR FROM sched.today)::int - EXTRACT(YEAR FROM sched.anchor)::int) * 12
            + (EXTRACT(MONTH FROM sched.today)::int - EXTRACT(MONTH FROM sched.anchor)::int) AS months_since
    ) ms
    CROSS JOIN LATERAL (
        SELECT (ms.months_since / sched.months) * sched.months AS aligned
    ) al
    CROSS JOIN LATERAL (
        SELECT CASE
                   -- The schedule has not started yet.
                   WHEN sched.today < sched.anchor THEN NULL

                   -- MONTHLY: the aligned month's slot, or the previous interval's when this month's
                   -- day is still ahead (today is the 5th, the slot is the 15th). A slot before the
                   -- anchor never counts — anchoring on 10 August with "the 1st" means the first
                   -- report is 1 September, not 1 August.
                   WHEN sched.mode = 'MONTHLY' THEN (
                       SELECT max(cand)
                       FROM (VALUES
                           (public.monthly_slot(sched.anchor, al.aligned, sched.dom)),
                           (public.monthly_slot(sched.anchor, al.aligned - sched.months, sched.dom))
                       ) v(cand)
                       WHERE cand <= sched.today AND cand >= sched.anchor
                   )

                   -- INTERVAL: unchanged. `date - date` is whole days and is non-negative here, so
                   -- integer division truncates the same way floor() would.
                   ELSE sched.anchor + (((sched.today - sched.anchor) / sched.step) * sched.step)
               END AS current_slot
    ) slot
    WHERE c.active
      AND slot.current_slot IS NOT NULL
      AND (sched.last_report IS NULL OR sched.last_report < slot.current_slot);
$$;

GRANT EXECUTE ON FUNCTION public.due_clients() TO service_role;
GRANT EXECUTE ON FUNCTION public.monthly_slot(date, int, int) TO service_role;
