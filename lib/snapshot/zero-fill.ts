// Explicit zero-rows for confirmed no-delivery days. Meta/Zernio return no timeline row for a day
// an account had zero delivery, so a *missing* Snapshot is ambiguous: no delivery, or never fetched
// / fetch failed? We resolve it by writing an all-zero row for every day in the trailing re-pull
// window that a *successful* fetch didn't cover. After this, a missing row unambiguously means the
// day was never fetched (fetch failure — which also logs a SyncError), never "no delivery".
//
// Bounded to the trailing re-pull window (never the deep backfill) so a brand-new account can't
// synthesize hundreds of rows, and so every synthesized day sits inside the window that gets
// re-pulled and upserted daily — a lagging Zernio sync overwrites a false zero on the next run
// rather than freezing it. Pure + dependency-light so it unit-tests without the app or DB.

import { DAY_MS } from "@/lib/constants";
import type { SnapshotData } from "@/lib/zernio/types";

const ymd = (d: Date): string => d.toISOString().slice(0, 10);
const startOfUtcDayMs = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * UTC-day floor (ms) from which to synthesize zero-rows: `windowDays` before `now`, but never
 * earlier than the actual fetch start `from`. Clamping to `from` keeps a first-ever pull (whose
 * `from` is the account's creation day) from back-filling zeros before the account existed, and
 * caps a gap re-pull to the recent window instead of the whole gap.
 */
export function zeroFillFloor(now: Date, from: Date, windowDays: number): number {
    const windowFloor = startOfUtcDayMs(new Date(now.getTime() - windowDays * DAY_MS));
    return Math.max(startOfUtcDayMs(from), windowFloor);
}

/**
 * Whole UTC days in [floorMs, today) that `have` (the YYYY-MM-DD dates Zernio returned) is missing.
 * Today is excluded because it's a partial day — the 00:45 cron would otherwise stamp "no delivery"
 * on a day that has simply barely started.
 */
export function missingZeroFillDates(have: Set<string>, floorMs: number, now: Date): string[] {
    const end = startOfUtcDayMs(now); // exclusive → skips the partial current day
    const out: string[] = [];
    for (let t = floorMs; t < end; t += DAY_MS) {
        const day = ymd(new Date(t));
        if (!have.has(day)) out.push(day);
    }
    return out;
}

/**
 * An all-zero timeline row for a confirmed no-delivery day. Empty action maps mean
 * lib/metrics/extract.ts reads zero purchases/leads and null (unmeasured) revenue/link-clicks —
 * exactly a day with no activity, contributing nothing to summed KPIs.
 */
export function zeroSnapshotData(date: string, currency: string): SnapshotData {
    return {
        date,
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        conversions: 0,
        costPerConversion: 0,
        actions: {},
        actionValues: {},
        purchaseValue: 0,
        roas: 0,
        currency,
    };
}
