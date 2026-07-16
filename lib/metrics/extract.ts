// Derives trustworthy per-day facts from the raw Meta action maps Zernio stores on each timeline
// row (`actions`: action_type -> count, `actionValues`: action_type -> value). Zernio's own derived
// scalars must never feed KPIs: `conversions` mirrors Meta's pixel-config-dependent rollup
// (identical action patterns produced 2 vs 0 across accounts) and `purchaseValue`/`roas` mix
// non-purchase values into "revenue" (lead values produced a client-visible fake 74.5x ROAS).
// See the field notes in lib/zernio/types.ts.
//
// Deliberately dependency-free: pure functions over plain objects, unit-testable without the app.

export type ActionMap = Record<string, number> | null | undefined;

export interface ActionSpec {
    /**
     * Meta roll-up action_types in priority order. The first one present wins outright — a roll-up
     * already includes every channel-specific type below it, so nothing is ever added on top.
     */
    aggregates: readonly string[];
    /**
     * Channel-specific fallbacks, consulted only when no aggregate key is present. Groups (one per
     * attribution channel) are summed; within a group the entries are alternatives (broadest first,
     * first present wins), so overlapping roll-ups inside one channel are never double-counted.
     */
    specificGroups: readonly (readonly string[])[];
}

// Meta action_type vocabularies. Aggregates match Ads Manager's "Purchases" / "Leads" columns.
// LEADS was validated against the first customer's stored data (scratch/action-keys.sql, Jul 2026):
// the `lead` rollup is always present when leads occur and already subsumes the pixel/instant-form
// channels, so the specific groups only fire as a fallback. PURCHASES is unobserved in that
// (pure lead-gen) data set but retained for future e-commerce accounts. Zernio keeps Meta's
// namespace prefix (observed `offsite_conversion.fb_pixel_lead`), and `lookup` also tolerates the
// bare form should that ever change.
export const PURCHASES: ActionSpec = {
    aggregates: ["omni_purchase", "purchase"],
    specificGroups: [
        ["offsite_conversion.fb_pixel_purchase"], // website pixel
        ["app_custom_event.fb_mobile_purchase"], // app SDK
        ["onsite_web_app_purchase", "onsite_web_purchase", "onsite_app_purchase"], // FB/IG Shops
        ["offline_conversion.purchase"], // CRM uploads
    ],
};

export const LEADS: ActionSpec = {
    aggregates: ["lead"],
    specificGroups: [
        ["offsite_conversion.fb_pixel_lead"], // website pixel lead
        ["onsite_conversion.lead_grouped", "leadgen_grouped", "leadgen.other"], // on-Facebook instant forms
        ["onsite_web_lead"], // website lead measured on-site (observed in the first customer's data)
        ["offline_conversion.lead"],
    ],
};

export const LINK_CLICKS: ActionSpec = { aggregates: ["link_click"], specificGroups: [] };

const norm = (key: string): string => key.trim().toLowerCase();

const toFinite = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

/**
 * Finds one spec key in a raw map. A namespaced spec key (contains ".") also matches its bare last
 * segment — but a bare spec key never suffix-matches a namespaced raw key, so a raw
 * `offline_conversion.purchase` can't masquerade as the `purchase` roll-up and swallow a channel.
 * When both spellings of the same event are present, take the max, never the sum.
 */
function lookup(map: Record<string, number>, specKey: string): number | null {
    const spec = norm(specKey);
    const bare = spec.includes(".") ? spec.slice(spec.lastIndexOf(".") + 1) : null;

    let found: number | null = null;
    for (const [rawKey, rawValue] of Object.entries(map)) {
        const raw = norm(rawKey);
        if (raw !== spec && raw !== bare) continue;
        const v = toFinite(rawValue);
        if (v == null) continue;
        found = found == null ? v : Math.max(found, v);
    }
    return found;
}

/** null = no matching key in the map (or no map at all). 0 = a matching key reported zero. */
export function pickAction(map: ActionMap, spec: ActionSpec): number | null {
    if (!map || typeof map !== "object") return null;

    for (const key of spec.aggregates) {
        const v = lookup(map, key);
        if (v != null) return v;
    }

    let sum: number | null = null;
    for (const group of spec.specificGroups) {
        for (const key of group) {
            const v = lookup(map, key);
            if (v != null) {
                sum = (sum ?? 0) + v;
                break; // group entries are alternatives for one channel, never additive
            }
        }
    }
    return sum;
}

export interface RowFacts {
    /** Purchase conversions counted this day. */
    purchases: number;
    /** Purchase-attributed value; null when no purchase value was measured (never a fake 0). */
    revenue: number | null;
    /** Lead conversions counted this day. */
    leads: number;
    /** Link clicks; null when the row's actions don't break them out (unmeasured ≠ zero). */
    linkClicks: number | null;
}

/**
 * Meta omits action types with no events, so an absent map or missing key means "none happened":
 * the count facts read 0. The value facts stay null instead — `revenue` because an unmeasured
 * value must never render as ROAS 0.00x, `linkClicks` because a missing breakdown more likely
 * means the source didn't report it than that nobody clicked; the aggregation layer falls back to
 * all clicks when an entire window lacks it.
 */
export function extractRowFacts(row: { actions?: ActionMap; actionValues?: ActionMap }): RowFacts {
    return {
        purchases: pickAction(row.actions, PURCHASES) ?? 0,
        revenue: pickAction(row.actionValues, PURCHASES),
        leads: pickAction(row.actions, LEADS) ?? 0,
        linkClicks: pickAction(row.actions, LINK_CLICKS),
    };
}
