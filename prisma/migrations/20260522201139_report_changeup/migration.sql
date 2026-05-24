/*
  Warnings:

  - You are about to alter the column `conversions` on the `Report` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Added the required column `anomalies` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campaigns` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clicks` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `daily_kpis` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `executive_summary` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `impressions` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mom_delta` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `next_month_focus` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `next_report_date` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `performance_score` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `previous_period` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recommendations` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `score_label` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trend_direction` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trend_explanation` to the `Report` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ScoreLabel" AS ENUM ('STRONG', 'MODERATE', 'NEEDS_IMPROVEMENT');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "anomalies" JSONB NOT NULL,
ADD COLUMN     "campaigns" JSONB NOT NULL,
ADD COLUMN     "clicks" INTEGER NOT NULL,
ADD COLUMN     "context_comment" TEXT,
ADD COLUMN     "daily_kpis" JSONB NOT NULL,
ADD COLUMN     "executive_summary" TEXT NOT NULL,
ADD COLUMN     "impressions" INTEGER NOT NULL,
ADD COLUMN     "mom_delta" JSONB NOT NULL,
ADD COLUMN     "next_month_focus" TEXT NOT NULL,
ADD COLUMN     "next_report_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "performance_score" INTEGER NOT NULL,
ADD COLUMN     "performance_score_delta" INTEGER,
ADD COLUMN     "previous_period" JSONB NOT NULL,
ADD COLUMN     "recommendations" JSONB NOT NULL,
ADD COLUMN     "score_label" "ScoreLabel" NOT NULL,
ADD COLUMN     "target_cpa" DOUBLE PRECISION,
ADD COLUMN     "target_roas" DOUBLE PRECISION,
ADD COLUMN     "trend_direction" JSONB NOT NULL,
ADD COLUMN     "trend_explanation" TEXT NOT NULL,
ALTER COLUMN "revenue" DROP NOT NULL,
ALTER COLUMN "roas" DROP NOT NULL,
ALTER COLUMN "cpa" DROP NOT NULL,
ALTER COLUMN "conversions" SET DATA TYPE INTEGER,
ALTER COLUMN "cpc" DROP NOT NULL,
ALTER COLUMN "reach" DROP NOT NULL,
ALTER COLUMN "frequency" DROP NOT NULL,
ALTER COLUMN "frequency" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Snapshot" ALTER COLUMN "platform" DROP DEFAULT;
