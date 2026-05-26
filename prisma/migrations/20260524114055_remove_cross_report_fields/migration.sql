-- Drop cross-report and forward-looking fields from Report.
-- These represented relationships to other reports (previous/next) and are now
-- either derived at render time from sibling reports or removed entirely.

ALTER TABLE "Report" DROP COLUMN "previous_period";
ALTER TABLE "Report" DROP COLUMN "mom_delta";
ALTER TABLE "Report" DROP COLUMN "trend_direction";
ALTER TABLE "Report" DROP COLUMN "performance_score_delta";
ALTER TABLE "Report" DROP COLUMN "next_month_focus";
