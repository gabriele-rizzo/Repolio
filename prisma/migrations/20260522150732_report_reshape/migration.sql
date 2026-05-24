/*
  Warnings:

  - You are about to drop the column `last_report` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `next_report` on the `Client` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Client" DROP COLUMN "last_report",
DROP COLUMN "next_report";
