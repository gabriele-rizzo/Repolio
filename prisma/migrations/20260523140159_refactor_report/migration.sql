/*
  Warnings:

  - You are about to drop the column `snapshot_id` on the `Report` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_snapshot_id_fkey";

-- DropIndex
DROP INDEX "Report_snapshot_id_key";

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "snapshot_id";

-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "report_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
