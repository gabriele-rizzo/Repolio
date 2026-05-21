-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('META');

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "next_report" SET DEFAULT (now() + interval '30 days');

-- CreateTable
CREATE TABLE "AccountConnection" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "platform" "Platform" NOT NULL,
    "access_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountConnection_client_id_platform_key" ON "AccountConnection"("client_id", "platform");

-- AddForeignKey
ALTER TABLE "AccountConnection" ADD CONSTRAINT "AccountConnection_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
