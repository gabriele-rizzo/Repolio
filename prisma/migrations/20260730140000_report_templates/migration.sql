-- Client-authored report templates.
--
-- One row per owner: `client_id` set = that client's default layout, `ad_account_id` set = an override
-- for a single ad account. Both columns are nullable and UNIQUE — Postgres allows many NULLs in a
-- unique index, so this enforces "at most one template per client" and "at most one per ad account"
-- without needing two partial indexes.
--
-- No backfill and no default row: resolution falls through account override -> client default -> the
-- built-in preset in lib/report/template/presets.ts, whose DEFAULT body reproduces the layout the PDF
-- and report email already had. So an empty table means every client keeps exactly the report they
-- were getting before this migration.

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "client_id" INTEGER,
    "ad_account_id" INTEGER,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_client_id_key" ON "ReportTemplate"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_ad_account_id_key" ON "ReportTemplate"("ad_account_id");

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
