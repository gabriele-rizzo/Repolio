/*
  Warnings:

  - Added the required column `external_id` to the `AccountConnection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AccountConnection" ADD COLUMN     "external_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "next_report" SET DEFAULT (now() + interval '30 days');
