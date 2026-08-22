-- Self-serve access requests, queued for an admin on /admin/enrollment.
--
-- Until now the only way in was manual enrollment: an admin typed a name and an email and Supabase
-- sent the invite. A visitor who found the site had nothing to do but leave. This table is the
-- waiting room — the public form writes a row here, and NOTHING else happens until an admin accepts
-- it, at which point the existing invite path runs unchanged.
--
-- It grants nothing on its own: no auth user, no Client, no session. That is the point of keeping it
-- in its own table rather than creating a dormant Client row — a Client is created by the Supabase
-- trigger on auth.users, so a row here can never be mistaken for an account.
--
-- Additive and read by nothing on the client-facing side, so the code tolerates this migration being
-- unapplied: /admin/enrollment degrades to a note (same contract as CronRun on /admin/health) and the
-- public form reports that registration is unavailable rather than 500-ing.

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'de',
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessRequest_status_created_at_idx" ON "AccessRequest"("status", "created_at");

-- CreateIndex
CREATE INDEX "AccessRequest_email_idx" ON "AccessRequest"("email");
