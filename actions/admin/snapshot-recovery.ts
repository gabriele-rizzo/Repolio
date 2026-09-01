"use server";

import { repullRange } from "@/actions/snapshot/repull-range";
import type { Platform } from "@/generated/prisma/browser";
import { Prisma } from "@/generated/prisma/client";
import { safeAction } from "@/lib/action";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { DAY_MS, RECOVERY_RANGES_PER_REQUEST } from "@/lib/constants";
import { createBudget } from "@/lib/cron/budget";
import { prisma } from "@/lib/prisma";
import { actionLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { missingDays, padRanges, totalDays, zeroRuns, type DayRange, type HistoryDay } from "@/lib/snapshot/gaps";
import { failed } from "@/lib/try-catch";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/**
 * Recovery for a provider outage — the Zernio billing lapse of Aug 2026 being the case it was
 * written for. See lib/snapshot/gaps.ts for the two ways such an outage damages stored history and
 * why detection keys off the DATA rather than off the SyncError log.
 *
 * Two calls, deliberately, matching actions/admin/repair-ai-text.ts: scan reads, re-pull writes. An
 * admin sees exactly which accounts and which day ranges would be re-fetched before anything is
 * requested from Zernio, because a re-pull spends provider quota and rewrites rows that reports may
 * already have narrated.
 *
 * ON RETAINING THE FAILED WINDOW — which is the part that looks like it needs a schema change and
 * doesn't. There is no stored "failed window" column, and adding one would not have helped, because
 * the damage the pipeline cannot see is precisely the damage that never logged an error:
 *
 *   · A fetch that FAILED wrote nothing, so the account's newest recorded day still tops out before
 *     the outage and the daily pull's own window rule (min(last recorded day, trailing floor) in
 *     fetch-snapshot.ts) already stretches back across the whole gap by itself. That window is
 *     recovered from the data, exactly, on the next ordinary run — nothing to retain.
 *   · A fetch that SUCCEEDED WITH NO ROWS wrote fake zeros, which ADVANCED the newest recorded day
 *     past the outage, so the daily rule now steps over it forever. No error was logged, so a
 *     retained-window column would hold nothing for it either.
 *
 * So the window is reconstructed here from the observed history instead, which has the property a
 * stored window would not: it is self-verifying. A healed day stops being reported on the next scan,
 * with no resolved-flag bookkeeping that can drift out of sync with what is actually in the table.
 */

/** How far back a scan looks. Long enough to cover a multi-week outage plus the reports built on it. */
const SCAN_DAYS = 120;

/** Days added either side of every detected range before re-pulling — see padRanges in gaps.ts. */
const PAD_DAYS = 1;

/** Accounts per scan. A scan runs inside one serverless request; a second pass is one more click. */
const SCAN_ACCOUNT_LIMIT = 200;

/**
 * Wall clock one re-pull request may spend STARTING ranges, and the floor it assumes each one costs.
 *
 * Same reasoning as lib/cron/budget.ts, which this borrows: Vercel kills a function at maxDuration
 * without unwinding, so an overrun is a silent truncation, not an error anyone can observe. Every
 * range that did start has already committed its rows (each upsert is autocommitted, see
 * repull-range.ts), so stopping early is safe — the caller is simply told what was left.
 */
const REPULL_BUDGET_MS = Number(process.env.REPULL_BUDGET_MS) || 45_000;
const RANGE_ESTIMATE_MS = 4_000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const startOfUtcDay = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export interface AccountDamage {
    adAccountId: number;
    accountName: string;
    clientName: string;
    platform: Platform;
    /** Days in the scan window with no stored row at all — a fetch that failed outright. */
    missing: DayRange[];
    /** Runs of stored all-zero days on an account that was spending before them — suspect, not proven. */
    suspectZero: DayRange[];
    /** What a re-pull would actually request: missing ∪ suspectZero, padded and merged. */
    repull: DayRange[];
    /** Total days the re-pull would cover. */
    repullDays: number;
}

export type RecoveryScan =
    | { error: string }
    | { scannedAccounts: number; from: string; to: string; damaged: AccountDamage[] };

async function guard(bucket: string): Promise<string | null> {
    const ip = clientIp((await headers()).get("x-forwarded-for"));
    const { success, retryAfterSeconds } = await checkLimit(actionLimiter, `${bucket}:${ip}`);
    if (!success) return `Too many requests. Please try again in ${retryAfterSeconds}s.`;

    // Server actions are public endpoints — gate independently of the admin layout UI.
    if (!(await isAdminAuthenticated())) return "Unauthorized.";

    return null;
}

/** The four fields damage detection needs, pulled straight out of the JSONB rather than as whole rows. */
interface HistoryRow {
    ad_account_id: number;
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
}

/**
 * Read-only. Finds every active account whose stored history looks damaged inside the scan window.
 *
 * Complete UTC days only, and never today: the current day is partial by definition, so it has no
 * row yet on most accounts and would be reported as a gap on all of them.
 */
export async function scanSnapshotDamage(): Promise<RecoveryScan> {
    const denied = await guard("recovery-scan");
    if (denied) return { error: denied };

    const now = Date.now();
    const toMs = startOfUtcDay(new Date(now)) - DAY_MS; // yesterday: the newest complete UTC day
    const fromMs = toMs - (SCAN_DAYS - 1) * DAY_MS;
    const from = ymd(fromMs);
    const to = ymd(toMs);

    let scannedAccounts = 0;
    const damaged: AccountDamage[] = [];

    const result = await safeAction(async () => {
        const accounts = await prisma.adAccount.findMany({
            where: { active: true, connection: { status: "CONNECTED", zernio_account_id: { not: null } } },
            orderBy: { id: "asc" },
            take: SCAN_ACCOUNT_LIMIT,
            select: {
                id: true,
                name: true,
                external_id: true,
                connection: { select: { platform: true, client: { select: { name: true } } } },
            },
        });

        scannedAccounts = accounts.length;
        if (accounts.length === 0) return;

        const ids = accounts.map((a) => a.id);

        // One grouped query for every account's history, not one per account (see CLAUDE.md). The
        // four metrics are extracted in SQL rather than by loading `data`: the blob is large and
        // 200 accounts x 120 days of it is a lot of JSON to ship and parse to answer "was this day
        // all zeros". Every field is coalesced — an older row shape missing a key must read as 0,
        // not NULL, or it would be neither a zero day nor a real one.
        const history = await prisma.$queryRaw<HistoryRow[]>`
            SELECT
                s.ad_account_id,
                to_char(s.start_date, 'YYYY-MM-DD')                       AS date,
                COALESCE((s.data->>'spend')::double precision,       0)   AS spend,
                COALESCE((s.data->>'impressions')::double precision, 0)   AS impressions,
                COALESCE((s.data->>'clicks')::double precision,      0)   AS clicks,
                COALESCE((s.data->>'conversions')::double precision, 0)   AS conversions
            FROM "Snapshot" s
            WHERE s.ad_account_id IN (${Prisma.join(ids)})
              AND s.start_date >= ${new Date(fromMs)}
              AND s.start_date <= ${new Date(toMs)}
            ORDER BY s.ad_account_id, s.start_date
        `;

        const byAccount = new Map<number, HistoryDay[]>();
        for (const row of history) {
            const day: HistoryDay = {
                date: row.date,
                spend: Number(row.spend),
                impressions: Number(row.impressions),
                clicks: Number(row.clicks),
                conversions: Number(row.conversions),
            };
            const bucket = byAccount.get(row.ad_account_id);
            if (bucket) bucket.push(day);
            else byAccount.set(row.ad_account_id, [day]);
        }

        for (const account of accounts) {
            const days = byAccount.get(account.id) ?? [];
            // An account with nothing at all in the window is not "120 days of damage" — it is an
            // account that has never synced, which /admin/health's stale list already reports and a
            // re-pull of a window it never had cannot fix.
            if (days.length === 0) continue;

            const have = new Set(days.map((d) => d.date));
            // Bounded to the account's own history: a day before its first stored row is not a gap,
            // it is a day the account did not exist for us yet (see missingDays in gaps.ts).
            const firstSeen = days[0].date;
            const missing = missingDays(have, firstSeen, to);
            const suspectZero = zeroRuns(days);

            if (missing.length === 0 && suspectZero.length === 0) continue;

            const repull = padRanges([...missing, ...suspectZero], PAD_DAYS);

            damaged.push({
                adAccountId: account.id,
                accountName: account.name ?? account.external_id,
                clientName: account.connection.client.name,
                platform: account.connection.platform,
                missing,
                suspectZero,
                repull,
                repullDays: totalDays(repull),
            });
        }

        // Worst first: the admin's attention is finite and a 40-day hole matters more than a 3-day one.
        damaged.sort((a, b) => b.repullDays - a.repullDays);
    });

    return result?.error ? result : { scannedAccounts, from, to, damaged };
}

export interface RepullRequest {
    adAccountId: number;
    ranges: { from: string; to: string }[];
}

export type RepullReport =
    | { error: string }
    | {
          /**
           * Ad accounts this request actually wrote something for — as ids, not a count, because the
           * caller aggregates several requests and a count would double-report an account that took
           * more than one bite.
           */
          touchedAccounts: number[];
          ranges: number;
          rows: number;
          unresolved: number;
          failures: string[];
          /**
           * Ranges this request did not START, because it ran out of wall clock or hit the per-request
           * bite. Returned rather than counted so the caller can re-send exactly them — the recovery UI
           * loops until this comes back empty, which is what lets one click heal more than one
           * request's worth of damage.
           */
          deferred: RepullRequest[];
      };

/**
 * Re-pulls the named ranges. Best-effort per range, like the rest of the pipeline: one dead account
 * must not abort the others, so failures are collected and reported rather than thrown.
 *
 * The ranges are taken from the client because the admin may have deselected some — but the account
 * is re-loaded and re-authorized here, and repullRange validates and bounds every range itself. A
 * caller cannot use this to rewrite an arbitrary window of an arbitrary account without an admin
 * session.
 *
 * ONE REQUEST IS A BITE, NOT THE WHOLE MEAL. An over-large selection used to be rejected outright,
 * which made the recovery screen look broken in exactly the situation it was built for: an outage
 * wide enough to damage 56 ranges produced a click that reported an error and changed nothing, so
 * the count sat there unchanged. Excess work is now DEFERRED and handed back instead, and the caller
 * re-sends it. At least one range always starts (the budget is fresh on every request), so a caller
 * that loops on `deferred` always terminates.
 */
export async function repullSnapshotRanges(requests: RepullRequest[]): Promise<RepullReport> {
    const denied = await guard("recovery-apply");
    if (denied) return { error: denied };

    const touchedAccounts = new Set<number>();
    let ranges = 0;
    let rows = 0;
    let unresolved = 0;
    const failures: string[] = [];
    const deferred: RepullRequest[] = [];

    const result = await safeAction(async () => {
        if (requests.length === 0) throw new Error("Nothing to re-pull.");

        const budget = createBudget(REPULL_BUDGET_MS);
        let started = 0;

        const ids = requests.map((r) => r.adAccountId);
        const found = await prisma.adAccount.findMany({
            where: { id: { in: ids }, active: true },
            include: { connection: true },
        });
        const byId = new Map(found.map((a) => [a.id, a]));

        for (const request of requests) {
            const account = byId.get(request.adAccountId);
            if (!account) {
                failures.push(`Ad account ${request.adAccountId} is gone or inactive — skipped.`);
                continue;
            }

            // Shape-checked BEFORE merging, not only inside repullRange: padRanges sorts and compares
            // by parsed timestamp, so one malformed string would reorder the set and could merge two
            // unrelated ranges into a window nobody asked to rewrite.
            const wellFormed = request.ranges.filter((r) => DAY.test(r.from) && DAY.test(r.to) && r.from <= r.to);
            if (wellFormed.length !== request.ranges.length) {
                failures.push(`Ad account ${request.adAccountId}: ignored a malformed range.`);
            }

            let touched = false;
            const postponed: { from: string; to: string }[] = [];

            // Ranges are re-merged server-side: a client that sent overlapping ranges would otherwise
            // pay for the same Zernio call twice against the per-request bite.
            for (const range of padRanges(wellFormed.map((r) => ({ ...r, days: 0 })), 0)) {
                // Bounded by wall clock as well as by count: 40 ranges of a two-week outage is 40
                // Zernio round-trips, which does not reliably fit in one invocation. Whatever is not
                // started goes back to the caller instead of being cut off mid-write by the platform.
                if (started >= RECOVERY_RANGES_PER_REQUEST || !budget.canStart(RANGE_ESTIMATE_MS)) {
                    postponed.push({ from: range.from, to: range.to });
                    continue;
                }

                started += 1;
                const outcome = await repullRange(account, range.from, range.to);
                ranges += 1;

                if (failed(outcome)) {
                    failures.push(outcome.error);
                    continue;
                }

                rows += outcome.data.upserted;
                unresolved += outcome.data.unresolved;
                touched = true;
            }

            // Deliberately not deferred for an account that was gone or inactive above: that work can
            // never succeed, and re-queueing it would spin the caller's loop forever.
            if (postponed.length > 0) deferred.push({ adAccountId: request.adAccountId, ranges: postponed });
            if (touched) touchedAccounts.add(request.adAccountId);
        }

        // Every KPI is recomputed from snapshots on demand, so rewriting these rows changes the
        // numbers on every surface at once — no derived cache to invalidate, only rendered pages.
        revalidatePath("/admin/recovery");
        revalidatePath("/admin/health");
        revalidatePath("/dashboard");
    });

    return result?.error
        ? result
        : { touchedAccounts: [...touchedAccounts], ranges, rows, unresolved, failures, deferred };
}
