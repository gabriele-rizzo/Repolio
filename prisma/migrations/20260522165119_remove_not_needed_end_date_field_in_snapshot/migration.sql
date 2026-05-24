/*
  Warnings:

  - You are about to drop the column `end_date` on the `Snapshot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[start_date,client_id]` on the table `Snapshot` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Snapshot_start_date_end_date_client_id_key";

-- AlterTable
ALTER TABLE "Snapshot" DROP COLUMN "end_date";

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_start_date_client_id_key" ON "Snapshot"("start_date", "client_id");
