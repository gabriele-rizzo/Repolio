/*
  Warnings:

  - A unique constraint covering the columns `[start_date,platform,client_id]` on the table `Snapshot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Snapshot_start_date_client_id_key";

-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "platform" "Platform" NOT NULL DEFAULT 'META';

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_start_date_platform_client_id_key" ON "Snapshot"("start_date", "platform", "client_id");
