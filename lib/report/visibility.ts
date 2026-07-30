import type { Prisma } from "@/generated/prisma/client";

/**
 * Prisma filter for the reports a client is allowed to see.
 *
 * Reports are created by the cron into an unsent ReportBatch and are invisible until an admin
 * validates that batch, which stamps `released_at`. That timestamp is the ONLY gate on client
 * visibility, so every client-facing report query must include this filter — a report the admin
 * excluded during validation keeps `released_at` null forever and must never surface.
 */
export const RELEASED_REPORT: Prisma.ReportWhereInput = { released_at: { not: null } };
