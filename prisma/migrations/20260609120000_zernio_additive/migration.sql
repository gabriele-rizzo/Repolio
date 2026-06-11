-- Zernio integration (additive). Tokens move to Zernio; we keep references to the
-- Zernio Profile + SocialAccount. Legacy direct-Meta columns are kept for now and
-- dropped in a follow-up migration once no code reads them.

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'GOOGLE';
ALTER TYPE "Platform" ADD VALUE 'TIKTOK';
ALTER TYPE "Platform" ADD VALUE 'LINKEDIN';
ALTER TYPE "Platform" ADD VALUE 'PINTEREST';
ALTER TYPE "Platform" ADD VALUE 'X';

-- AlterTable: Client gets its Zernio Profile reference
ALTER TABLE "Client" ADD COLUMN "zernio_profile_id" TEXT;

-- AlterTable: PlatformConnection gets Zernio references + status; legacy token becomes nullable
ALTER TABLE "PlatformConnection"
    ADD COLUMN "zernio_account_id" TEXT,
    ADD COLUMN "zernio_posting_account_id" TEXT,
    ADD COLUMN "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    ALTER COLUMN "access_token" DROP NOT NULL;

-- AlterTable: AdAccount gets currency + timezone (from Zernio /v1/ads/accounts)
ALTER TABLE "AdAccount"
    ADD COLUMN "currency" TEXT,
    ADD COLUMN "timezone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_zernio_profile_id_key" ON "Client"("zernio_profile_id");
