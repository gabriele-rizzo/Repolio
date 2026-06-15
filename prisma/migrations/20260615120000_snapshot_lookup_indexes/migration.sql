-- Speeds up the dominant Snapshot access pattern: filtering by ad_account_id over a date range
-- (dashboard cards, live metric windows) and the Report<->Snapshot join. The pre-existing unique
-- index on (start_date, ad_account_id) has start_date leading and cannot serve "ad_account_id = ?
-- AND start_date >= ?" efficiently.
--
-- NOTE: plain CREATE INDEX briefly locks the table against writes. On a large/production Snapshot
-- table prefer running these manually as:
--   CREATE INDEX CONCURRENTLY "Snapshot_ad_account_id_start_date_idx" ON "Snapshot"("ad_account_id", "start_date");
--   CREATE INDEX CONCURRENTLY "Snapshot_report_id_idx" ON "Snapshot"("report_id");
-- then `prisma migrate resolve --applied 20260615120000_snapshot_lookup_indexes` to record it.

-- CreateIndex
CREATE INDEX "Snapshot_ad_account_id_start_date_idx" ON "Snapshot"("ad_account_id", "start_date");

-- CreateIndex
CREATE INDEX "Snapshot_report_id_idx" ON "Snapshot"("report_id");
