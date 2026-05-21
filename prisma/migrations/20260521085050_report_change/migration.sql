/*
  Warnings:

  - You are about to drop the `Analysis` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Analysis" DROP CONSTRAINT "Analysis_snapshot_id_fkey";

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "next_report" SET DEFAULT (now() + interval '30 days');

-- DropTable
DROP TABLE "Analysis";

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spend" DOUBLE PRECISION NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "roas" DOUBLE PRECISION NOT NULL,
    "cpa" DOUBLE PRECISION NOT NULL,
    "conversions" DOUBLE PRECISION NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "cpm" DOUBLE PRECISION NOT NULL,
    "cpc" DOUBLE PRECISION NOT NULL,
    "reach" INTEGER NOT NULL,
    "frequency" INTEGER NOT NULL,
    "snapshot_id" INTEGER NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_snapshot_id_key" ON "Report"("snapshot_id");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "Snapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
