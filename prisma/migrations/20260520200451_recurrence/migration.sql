/*
  Warnings:

  - Made the column `next_report` on table `Client` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "next_report" SET NOT NULL,
ALTER COLUMN "next_report" SET DEFAULT (now() + interval '30 days');

-- CreateTable
CREATE TABLE "Recurrence" (
    "client_id" INTEGER NOT NULL,
    "ndays" DOUBLE PRECISION NOT NULL DEFAULT 30,

    CONSTRAINT "Recurrence_pkey" PRIMARY KEY ("client_id")
);

-- AddForeignKey
ALTER TABLE "Recurrence" ADD CONSTRAINT "Recurrence_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
