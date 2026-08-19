-- Observability for cron invocations: one row per run, written best-effort at the end.
--
-- The gap this closes: the daily job is best-effort by design (a failed client never aborts the
-- others), and Vercel kills the function at `maxDuration` without unwinding — no exception, no catch,
-- no log. Both make the interesting failure SILENT: fewer clients processed than exist, with nothing
-- anywhere saying so. SyncError records which account failed; nothing recorded whether the run
-- reached the end at all.
--
-- After this: `finished_at IS NULL` is a killed run, and `skipped > 0` is a run that ran out of wall
-- clock and abandoned its tail on purpose (summed across both phases of the daily job; `detail` keeps
-- the per-phase breakdown). `duration_ms` against CRON_BUDGET_MS is the early warning
-- before truncation starts.
--
-- Additive and nullable throughout — nothing reads this table to make a decision, so an unapplied
-- migration degrades to console logging (see lib/cron/run-record.ts) rather than breaking the cron.

-- CreateTable
CREATE TABLE "CronRun" (
    "id" SERIAL NOT NULL,
    "job" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "considered" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronRun_job_started_at_idx" ON "CronRun"("job", "started_at");
