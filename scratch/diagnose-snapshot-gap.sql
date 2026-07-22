-- Read-only diagnostics for the Jul 17–20 snapshot blackout. Run in the Supabase SQL editor.
-- None of these mutate data.

-- 1) Snapshot rows written per calendar day (confirms the gap + which accounts).
SELECT start_date::date AS day, count(*) AS rows, count(distinct ad_account_id) AS accounts
FROM "Snapshot"
WHERE start_date >= '2026-07-12'
GROUP BY 1 ORDER BY 1;

-- 2) Last successful sync per ad account. If the cron was KILLED mid-run (the timeout theory),
--    the big client's accounts stall at Jul 16 while the small/new accounts kept advancing.
SELECT a.id, a.name, a.last_synced_at, c.id AS client_id
FROM "AdAccount" a
JOIN "PlatformConnection" pc ON pc.id = a.connection_id
JOIN "Client" c ON c.id = pc.client_id
WHERE a.active
ORDER BY a.last_synced_at NULLS FIRST, c.id;

-- 3) Recorded fetch failures in the window. IMPORTANT: a timeout kill leaves NO SyncError row
--    (the process dies before it can log). So:
--      - rows here  -> fetches ran and failed loudly (Zernio/auth/DB), NOT a timeout
--      - empty here -> consistent with the function being killed before writing/logging
SELECT created_at, stage, client_id, ad_account_id, left(message, 200) AS message
FROM "SyncError"
WHERE created_at >= '2026-07-16'
ORDER BY created_at DESC
LIMIT 200;

-- 4) Was the sync_errors migration actually applied? (If this errors "relation does not exist",
--    the migration was never deployed — a separate problem from the timeout.)
SELECT count(*) AS sync_error_rows FROM "SyncError";

-- 5) Are the "dark" accounts' connections healthy, or were they flipped to DISCONNECTED?
SELECT pc.id, pc.platform, pc.status, count(a.id) AS ad_accounts
FROM "PlatformConnection" pc
LEFT JOIN "AdAccount" a ON a.connection_id = pc.id
GROUP BY pc.id, pc.platform, pc.status
ORDER BY pc.status, pc.id;
