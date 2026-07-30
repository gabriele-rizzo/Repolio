-- Per-client UI + report language (ISO 639-1), added by the i18n work but missing its migration,
-- which made every `prisma.client` read fail with P2022 (ColumnNotFound).
--
-- NOT NULL with a default so existing rows backfill in place; 'de' matches DEFAULT_LOCALE /
-- LOCALES[0] in i18n/request.ts.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'de';
