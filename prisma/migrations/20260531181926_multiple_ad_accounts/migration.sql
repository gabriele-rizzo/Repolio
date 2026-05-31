/*
  Warnings:

  - You are about to drop the `AccountConnection` table. All connection data
    (access tokens) will be lost; clients must reconnect their platforms.
  - The `client_id` column on `Snapshot` is replaced by `ad_account_id`. Existing
    snapshots cannot be migrated automatically and will be lost.

  Connections are now split into `PlatformConnection` (the OAuth credential, one
  per client + platform) and `AdAccount` (one per managed ad account). Snapshots
  hang off an ad account instead of a client.
*/

-- DropForeignKey
ALTER TABLE "AccountConnection" DROP CONSTRAINT "AccountConnection_client_id_fkey";

-- DropForeignKey
ALTER TABLE "Snapshot" DROP CONSTRAINT "Snapshot_client_id_fkey";

-- DropIndex
DROP INDEX "Snapshot_start_date_platform_client_id_key";

-- DropTable
DROP TABLE "AccountConnection";

-- AlterTable
ALTER TABLE "Snapshot" DROP COLUMN "client_id",
ADD COLUMN     "ad_account_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "PlatformConnection" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "platform" "Platform" NOT NULL,
    "access_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" SERIAL NOT NULL,
    "connection_id" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformConnection_client_id_platform_key" ON "PlatformConnection"("client_id", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_connection_id_external_id_key" ON "AdAccount"("connection_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_start_date_ad_account_id_key" ON "Snapshot"("start_date", "ad_account_id");

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "PlatformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
