"use server";

import { safeAction } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { repairStoredReport } from "@/lib/ai/sanitize";
import { prisma } from "@/lib/prisma";
import { actionLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/**
 * Backfill for reports generated before lib/ai/sanitize.ts existed — the ones that shipped with the
 * model's JSON-closing attempt and its self-repair narration inside the narrative a client reads.
 *
 * Two calls, deliberately: scan reads and reports, repair writes. An admin sees exactly which reports
 * would change, and what the text becomes, before anything is rewritten — this touches rows that were
 * already emailed, and there is no undo.
 *
 * Released reports are in scope, not just pending ones. The PDF that went out by email can't be
 * recalled, but the report page a client opens renders from these rows, and so does the trend history
 * fed back into the next generation's prompt — leaving debris there means the model keeps reading it.
 *
 * Bounded by SCAN_LIMIT rather than streaming the whole table: this runs inside a serverless request,
 * and a second pass is one more click.
 */

const SCAN_LIMIT = 500;

export interface DamagedReport {
    id: number;
    clientName: string;
    accountName: string;
    /** What a client currently reads, truncated for the screen. */
    before: string;
    /** What the repair would leave, truncated for the screen. */
    after: string;
    /** Recommendations that would be dropped because they were debris end to end. */
    droppedRecommendations: number;
}

export type ScanResult = { error: string } | { scanned: number; damaged: DamagedReport[] };

const PREVIEW_CHARS = 220;
const preview = (value: string): string =>
    value.length > PREVIEW_CHARS ? `${value.slice(0, PREVIEW_CHARS)}…` : value || "—";

async function guard(bucket: string): Promise<string | null> {
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(actionLimiter, `${bucket}:${ip}`);
    if (!success) return `Too many requests. Please try again in ${retryAfterSeconds}s.`;

    // Server actions are public endpoints — gate independently of the admin layout UI.
    if (!(await isAdminAuthenticated())) return "Unauthorized.";

    return null;
}

/** Read-only. Finds reports whose stored AI text carries model debris, newest first. */
export async function scanDamagedReports(): Promise<ScanResult> {
    const denied = await guard("repair-ai-scan");
    if (denied) return { error: denied };

    let scanned = 0;
    const damaged: DamagedReport[] = [];

    const result = await safeAction(async () => {
        const reports = await prisma.report.findMany({
            where: { ai_pending: false },
            orderBy: { id: "desc" },
            take: SCAN_LIMIT,
            select: {
                id: true,
                trend_explanation: true,
                recommendations: true,
                // One snapshot is enough to name the account — reports are one per ad account.
                snapshots: {
                    take: 1,
                    select: {
                        ad_account: {
                            select: { name: true, connection: { select: { client: { select: { name: true } } } } },
                        },
                    },
                },
            },
        });

        scanned = reports.length;

        for (const report of reports) {
            const repaired = repairStoredReport(report);
            if (!repaired) continue;

            const account = report.snapshots[0]?.ad_account;
            const before = Array.isArray(report.recommendations) ? report.recommendations.length : 0;

            damaged.push({
                id: report.id,
                clientName: account?.connection.client.name ?? "—",
                accountName: account?.name ?? `#${report.id}`,
                before: preview(report.trend_explanation ?? ""),
                after: preview(repaired.trend_explanation),
                droppedRecommendations: Math.max(0, before - repaired.recommendations.length),
            });
        }
    });

    return result?.error ? result : { scanned, damaged };
}

export type RepairResult = { error: string } | { repaired: number };

/**
 * Rewrites the reports named by `ids`. Each row is re-read and re-checked here rather than trusted
 * from the scan: the screen may be minutes old, and a report regenerated in the meantime must not be
 * overwritten with a repair computed against text it no longer has.
 */
export async function repairDamagedReports(ids: number[]): Promise<RepairResult> {
    const denied = await guard("repair-ai-apply");
    if (denied) return { error: denied };

    let repaired = 0;

    const result = await safeAction(async () => {
        if (ids.length === 0) throw new Error("Nothing to repair.");

        const reports = await prisma.report.findMany({
            where: { id: { in: ids }, ai_pending: false },
            select: { id: true, trend_explanation: true, recommendations: true },
        });

        for (const report of reports) {
            const clean = repairStoredReport(report);
            if (!clean) continue;

            await prisma.report.update({
                where: { id: report.id },
                data: {
                    trend_explanation: clean.trend_explanation,
                    recommendations: clean.recommendations as unknown as Prisma.InputJsonValue,
                },
            });

            repaired += 1;
        }

        revalidatePath("/admin/health");
        revalidatePath("/admin/validation");
        revalidatePath("/dashboard");
    });

    return result?.error ? result : { repaired };
}
