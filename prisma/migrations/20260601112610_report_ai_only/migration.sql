/*
  Reports no longer store computed metrics — KPIs, the performance score and
  anomalies are recomputed live on the report page from snapshots over a chosen
  window. Only the AI output and user input remain. The dropped columns' data is
  intentionally discarded. The "ScoreLabel" enum is kept (used by live computation).
*/
ALTER TABLE "Report"
    DROP COLUMN "spend",
    DROP COLUMN "revenue",
    DROP COLUMN "impressions",
    DROP COLUMN "clicks",
    DROP COLUMN "conversions",
    DROP COLUMN "reach",
    DROP COLUMN "frequency",
    DROP COLUMN "ctr",
    DROP COLUMN "cpm",
    DROP COLUMN "cpa",
    DROP COLUMN "cpc",
    DROP COLUMN "roas",
    DROP COLUMN "daily_kpis",
    DROP COLUMN "campaigns",
    DROP COLUMN "performance_score",
    DROP COLUMN "score_label",
    DROP COLUMN "anomalies";
