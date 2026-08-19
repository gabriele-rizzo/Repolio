import { extractRowFacts, hasFactExtractor } from "@/lib/metrics/extract";
import { extractMetaRowFacts } from "@/lib/metrics/extract/meta";
import { describe, expect, it } from "vitest";

// The registry is the point where a raw row is committed to one platform's interpretation. What matters
// is that it never guesses: a platform without an extractor must stop the caller, not quietly return
// zeroed facts that read as a real "converted nobody".

const META_ROW = { actions: { omni_purchase: 3, lead: 2, link_click: 40 }, actionValues: { omni_purchase: 750 } };

describe("hasFactExtractor", () => {
    it("is true only for platforms wired end-to-end", () => {
        expect(hasFactExtractor("META")).toBe(true);
        // Declared in the Platform enum and shown in the UI, but with no Zernio integration and so no
        // rows and no vocabulary. Update this when one is wired.
        for (const platform of ["GOOGLE", "TIKTOK", "LINKEDIN", "PINTEREST", "X"] as const) {
            expect(hasFactExtractor(platform)).toBe(false);
        }
    });
});

describe("extractRowFacts", () => {
    it("routes META rows to the Meta extractor, unchanged", () => {
        // The seam must be transparent: going through the registry has to equal calling the platform
        // implementation directly, or the refactor changed the numbers.
        expect(extractRowFacts("META", META_ROW)).toEqual(extractMetaRowFacts(META_ROW));
        expect(extractRowFacts("META", META_ROW)).toEqual({
            purchases: 3,
            revenue: 750,
            leads: 2,
            linkClicks: 40,
        });
    });

    it("throws for a platform with no extractor rather than zeroing its facts", () => {
        // Falling back to Meta's vocabulary would find none of another platform's keys and return
        // "0 purchases, 0 leads, no revenue" — a wrong number indistinguishable from a real one.
        expect(() => extractRowFacts("GOOGLE", META_ROW)).toThrowError(/No fact extractor for platform 'GOOGLE'/);
        expect(() => extractRowFacts("TIKTOK", {})).toThrowError(/would report zeroed conversions as fact/);
    });

    it("names the file to edit, so the fix is obvious from the message alone", () => {
        expect(() => extractRowFacts("GOOGLE", {})).toThrowError(/lib\/metrics\/extract\/index\.ts/);
    });

    it("still reads a row that carries no maps at all", () => {
        // An absent map means "nothing happened" for counts and "unmeasured" for values.
        expect(extractRowFacts("META", { spend: 10 })).toEqual({
            purchases: 0,
            revenue: null,
            leads: 0,
            linkClicks: null,
        });
    });
});
