import { describe, expect, it } from "vitest";
import { extractMetaRowFacts, LEADS, LINK_CLICKS, pickAction, PURCHASES } from "./meta";

describe("pickAction", () => {
    it("returns null for an absent or non-object map", () => {
        expect(pickAction(undefined, PURCHASES)).toBeNull();
        expect(pickAction(null, PURCHASES)).toBeNull();
    });

    it("returns null when no key matches", () => {
        expect(pickAction({ landing_page_view: 40, post_engagement: 120 }, PURCHASES)).toBeNull();
    });

    it("returns 0 when a matching key reports zero (measured zero ≠ unmeasured)", () => {
        expect(pickAction({ purchase: 0 }, PURCHASES)).toBe(0);
    });

    it("aggregate wins outright over channel-specific keys", () => {
        // purchase (7) already contains the pixel purchases (7) — summing would double-count.
        expect(pickAction({ purchase: 7, "offsite_conversion.fb_pixel_purchase": 7 }, PURCHASES)).toBe(7);
    });

    it("prefers omni_purchase over purchase when both are present", () => {
        expect(pickAction({ omni_purchase: 9, purchase: 7 }, PURCHASES)).toBe(9);
    });

    it("matches a namespaced spec key by its bare last segment (Zernio strips prefixes)", () => {
        expect(pickAction({ fb_pixel_lead: 5 }, LEADS)).toBe(5);
    });

    it("takes the max, not the sum, when both spellings of one event are present", () => {
        expect(pickAction({ fb_pixel_lead: 5, "offsite_conversion.fb_pixel_lead": 5 }, LEADS)).toBe(5);
    });

    it("never lets a namespaced raw key masquerade as a bare aggregate", () => {
        // offline purchases are a channel, not the roll-up; with no aggregate present they surface
        // via their own group instead.
        expect(pickAction({ "offline_conversion.purchase": 3 }, PURCHASES)).toBe(3);
        // ...and with the real roll-up present, the roll-up wins.
        expect(pickAction({ purchase: 10, "offline_conversion.purchase": 3 }, PURCHASES)).toBe(10);
    });

    it("sums across channel groups when no aggregate is present", () => {
        const map = {
            "offsite_conversion.fb_pixel_purchase": 4,
            "offline_conversion.purchase": 2,
        };
        expect(pickAction(map, PURCHASES)).toBe(6);
    });

    it("counts on-site web leads (observed channel) when the lead rollup is absent", () => {
        expect(pickAction({ onsite_web_lead: 4 }, LEADS)).toBe(4);
        // ...but the rollup still wins outright when present (it already includes this channel).
        expect(pickAction({ lead: 4, onsite_web_lead: 4 }, LEADS)).toBe(4);
    });

    it("treats entries within one group as alternatives, not additive", () => {
        // web_app is the roll-up of web + app inside the Shops channel.
        const map = { onsite_web_app_purchase: 5, onsite_web_purchase: 3 };
        expect(pickAction(map, PURCHASES)).toBe(5);
    });

    it("is case- and whitespace-insensitive", () => {
        expect(pickAction({ " Purchase ": 2 } as unknown as Record<string, number>, PURCHASES)).toBe(2);
    });

    it("coerces string values and skips non-numeric ones", () => {
        expect(pickAction({ lead: "12" } as unknown as Record<string, number>, LEADS)).toBe(12);
        expect(pickAction({ lead: "n/a" } as unknown as Record<string, number>, LEADS)).toBeNull();
    });

    it("extracts link clicks by their single action type", () => {
        expect(pickAction({ link_click: 19, post_engagement: 80 }, LINK_CLICKS)).toBe(19);
        expect(pickAction({ post_engagement: 80 }, LINK_CLICKS)).toBeNull();
    });
});

describe("extractMetaRowFacts", () => {
    it("reads counts as 0 and values as null when the row has no maps (no actions that day)", () => {
        expect(extractMetaRowFacts({})).toEqual({ purchases: 0, revenue: null, leads: 0, linkClicks: null });
    });

    it("never counts lead values as purchase revenue (the fake-ROAS bug)", () => {
        // Account 506's shape from the analysis: lead values in actionValues, zero purchases.
        const row = {
            actions: { fb_pixel_lead: 2, link_click: 19 },
            actionValues: { fb_pixel_lead: 1800 },
        };
        expect(extractMetaRowFacts(row)).toEqual({ purchases: 0, revenue: null, leads: 2, linkClicks: 19 });
    });

    it("extracts purchase revenue only from purchase action values", () => {
        const row = {
            actions: { purchase: 3, lead: 1, link_click: 40 },
            actionValues: { purchase: 249.5, lead: 500 },
        };
        expect(extractMetaRowFacts(row)).toEqual({ purchases: 3, revenue: 249.5, leads: 1, linkClicks: 40 });
    });

    it("leaves linkClicks null when actions exist but carry no link_click breakdown", () => {
        const row = { actions: { lead: 4 } };
        expect(extractMetaRowFacts(row)).toEqual({ purchases: 0, revenue: null, leads: 4, linkClicks: null });
    });
});
