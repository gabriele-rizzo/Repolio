-- Additive only; safe on a live database (a nullable column without default is a catalog-only
-- change in Postgres; the new table and its indexes start empty).
--
-- Hand-authored (the dev environment points at the production database, so `prisma migrate dev`
-- must not run here). Apply with `pnpm prisma migrate deploy`, or paste into the Supabase SQL
-- editor and then run `pnpm prisma migrate resolve --applied 20260716120000_sync_errors`.

-- AlterTable
ALTER TABLE "AdAccount" ADD COLUMN "last_synced_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SyncError" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "client_id" INTEGER,
    "ad_account_id" INTEGER,

    CONSTRAINT "SyncError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncError_created_at_idx" ON "SyncError"("created_at");

-- CreateIndex
CREATE INDEX "SyncError_ad_account_id_created_at_idx" ON "SyncError"("ad_account_id", "created_at");

-- AddForeignKey
ALTER TABLE "SyncError" ADD CONSTRAINT "SyncError_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncError" ADD CONSTRAINT "SyncError_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
