-- Post-fix verification for the day of 2026-07-23 (crons: daily @ 00:00 UTC = snapshots+poll,
-- collect @ 05:00 UTC = report writeback). Read-only; none of these mutate data.
-- Follows up scratch/diagnose-snapshot-gap.sql after the Jul 22 timeout fix.

-- 1) SNAPSHOTS WRITTEN BY TODAY'S RUN. Rows the daily cron committed today (created_at), grouped by
--    the metric day they cover (start_date). Healthy: a row for today, covering recent days, across
--    all the accounts that were dark Jul 17-20.
SELECT created_at::date AS written_on,
       start_date::date AS metric_day,
       count(*) AS rows,
       count(distinct ad_account_id) AS accounts
FROM "Snapshot"
WHERE created_at >= '2026-07-23'
GROUP BY 1, 2 ORDER BY 1, 2;

-- 2) THE GAP, END TO END. Snapshot coverage per metric day across the blackout through today.
--    Healthy: Jul 17-20 backfilled (poll self-heal) AND no new hole after the fix.
SELECT start_date::date AS metric_day,
       count(*) AS rows,
       count(distinct ad_account_id) AS accounts
FROM "Snapshot"
WHERE start_date >= '2026-07-12'
GROUP BY 1 ORDER BY 1;

-- 3) EVERY ACTIVE ACCOUNT FRESH? last_synced_at should be within ~48h for all active accounts.
--    Any NULL or stale row = an account today's run did not reach (the old timeout symptom).
SELECT a.id, a.name, a.last_synced_at, c.id AS client_id,
       (now() - a.last_synced_at) AS staleness
FROM "AdAccount" a
JOIN "PlatformConnection" pc ON pc.id = a.connection_id
JOIN "Client" c ON c.id = pc.client_id
WHERE a.active
ORDER BY a.last_synced_at NULLS FIRST, c.id;

-- 4) FAILURES LOGGED SINCE THE FIX. With per-client isolation + logSyncError, real fetch/DB/auth
--    failures now leave a row (a silent timeout kill would not). Empty = clean run.
SELECT created_at, stage, client_id, ad_account_id, left(message, 200) AS message
FROM "SyncError"
WHERE created_at >= '2026-07-22'
ORDER BY created_at DESC
LIMIT 200;

-- 5) REPORTS FROM TODAY. poll (00:00) creates the row + submits the AI batch (ai_pending=true);
--    collect (05:00) writes the result back (ai_pending flips to false). Healthy AFTER 05:00 UTC:
--    ai_pending = false and non-empty executive_summary. Rows stuck pending => collect didn't land.
SELECT id, created_at, ai_pending, batch_id,
       (executive_summary <> '') AS has_summary,
       (select count(*) from "Snapshot" s where s.report_id = r.id) AS snapshot_count
FROM "Report" r
WHERE created_at >= '2026-07-23'
ORDER BY created_at DESC;

-- 6) NO STUCK BATCHES. Any report still ai_pending from before today means a prior writeback never
--    completed. Healthy: empty (or only reports created within the last few hours pre-05:00 UTC).
SELECT id, created_at, batch_id
FROM "Report"
WHERE ai_pending = true
ORDER BY created_at;
