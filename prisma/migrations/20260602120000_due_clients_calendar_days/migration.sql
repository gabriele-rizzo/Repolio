-- Switch due_clients() to CALENDAR-DAY granularity.
--
-- Previously the elapsed time was compared as an exact interval
-- (now - anchor >= ndays * interval '1 day'), so a report generated at, say,
-- 16:00 two days ago counted as only ~1.67 days old and a client with ndays = 2
-- would not come due until the exact 48h mark. Reports are scheduled per
-- calendar day, so we now truncate both endpoints to start-of-day and compare
-- whole days: a report made any time on day D makes the client due on day
-- D + ndays, regardless of the time of day.
--
-- now() AT TIME ZONE 'utc' yields the current UTC wall-clock; casting it and the
-- anchor to ::date drops the time component (`date - date` returns whole days).
-- Prisma stores timestamps as UTC wall-clock (no time zone), so the dates align.

CREATE OR REPLACE FUNCTION public.due_clients()
RETURNS SETOF "Client"
LANGUAGE sql
STABLE
AS $$
    SELECT c.*
    FROM "Client" c
    WHERE c.active
      AND (now() AT TIME ZONE 'utc')::date - COALESCE(
              (
                  SELECT max(r.created_at)
                  FROM "Report" r
                  JOIN "Snapshot" s ON s.report_id = r.id
                  JOIN "AdAccount" a ON a.id = s.ad_account_id
                  JOIN "PlatformConnection" pc ON pc.id = a.connection_id
                  WHERE pc.client_id = c.id
              ),
              c.created_at
          )::date >= COALESCE(
              (SELECT rec.ndays FROM "Recurrence" rec WHERE rec.client_id = c.id),
              30
          );
$$;

GRANT EXECUTE ON FUNCTION public.due_clients() TO service_role;
