-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REPORT_READY');

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_client_id_created_at_idx" ON "Notification"("client_id", "created_at");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
