-- Report validation + batched delivery.
--
-- Reports used to be visible to the client (and emailed, one email each) the moment the cron created
-- them. They are now generated into a per-client ReportBatch that an admin reviews first; validating
-- the batch releases the approved reports and sends ONE email with all of them attached.
--
-- `released_at` is the single gate on client visibility, so the backfill below is load-bearing:
-- every report that already exists was already delivered, and must stay visible. Backfilling it to
-- created_at (not now()) keeps report ordering and "report age" copy honest.

-- CreateTable
CREATE TABLE "ReportBatch" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_id" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "ReportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportBatch_client_id_created_at_idx" ON "ReportBatch"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "ReportBatch_sent_at_created_at_idx" ON "ReportBatch"("sent_at", "created_at");

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "released_at" TIMESTAMP(3),
ADD COLUMN     "report_batch_id" INTEGER;

-- CreateIndex
CREATE INDEX "Report_report_batch_id_idx" ON "Report"("report_batch_id");

-- AddForeignKey
ALTER TABLE "ReportBatch" ADD CONSTRAINT "ReportBatch_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_report_batch_id_fkey" FOREIGN KEY ("report_batch_id") REFERENCES "ReportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: pre-existing reports were already delivered to their clients, so release them all.
-- Without this every client's report history would vanish from their dashboard on deploy.
UPDATE "Report" SET "released_at" = "created_at" WHERE "released_at" IS NULL;
