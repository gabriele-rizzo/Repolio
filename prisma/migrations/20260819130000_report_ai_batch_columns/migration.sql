-- Records two columns that already exist in production but were never captured in a migration.
--
-- `Report.ai_pending` and `Report.batch_id` are declared in prisma/schema.prisma and written by the
-- poll cron (lib/cron/poll.ts marks reports pending and stamps the Anthropic batch id) and read by
-- lib/report/ai-status.ts. So they are certainly present in the production database — they were added
-- there by hand, and no migration ever recorded them. The migration history therefore did not
-- reproduce the schema: a database built from prisma/migrations alone would be missing both, and
-- report generation would fail against it.
--
-- Found by the migration-drift job in CI (`prisma migrate diff --from-migrations`), not by anything
-- going wrong at runtime — which is the point of that job. Nothing was broken; the record was.
--
-- IF NOT EXISTS on both statements, so this is a no-op against production (the columns are already
-- there) while still creating them on a fresh replay. Applying it costs nothing and closes the gap in
-- the history.

-- AlterTable
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "ai_pending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "batch_id" TEXT;
