-- Returns the active clients that are due for a new report.
--
-- A client is due when the time elapsed since its most recent report is at least
-- its recurrence interval (`Recurrence.ndays`, defaulting to 30 when no row exists).
-- "Most recent report" is resolved through the relation chain
-- Report -> Snapshot -> AdAccount -> PlatformConnection -> Client, so it works with
-- multiple ad accounts per client. Clients with no reports yet fall back to their
-- creation date, so the first report is due one full interval after sign-up.
--
-- Timestamps are compared in UTC because Prisma stores `timestamp` columns as UTC
-- wall-clock values (no time zone). Called with no arguments via supabase.rpc().

CREATE OR REPLACE FUNCTION public.due_clients()
RETURNS SETOF "Client"
LANGUAGE sql
STABLE
AS $$
    SELECT c.*
    FROM "Client" c
    WHERE c.active
      AND (now() AT TIME ZONE 'utc') - COALESCE(
              (
                  SELECT max(r.created_at)
                  FROM "Report" r
                  JOIN "Snapshot" s ON s.report_id = r.id
                  JOIN "AdAccount" a ON a.id = s.ad_account_id
                  JOIN "PlatformConnection" pc ON pc.id = a.connection_id
                  WHERE pc.client_id = c.id
              ),
              c.created_at
          ) >= COALESCE(
              (SELECT rec.ndays FROM "Recurrence" rec WHERE rec.client_id = c.id),
              30
          ) * interval '1 day';
$$;

GRANT EXECUTE ON FUNCTION public.due_clients() TO service_role;
