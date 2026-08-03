import { dateFormatRelative } from "@/lib/date/format-relative";
import { describe, expect, it } from "vitest";

const base = new Date(2026, 7, 3); // 3 August 2026, local
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

const tDate = (key: "today" | "yesterday" | "tomorrow") =>
    ({ today: "Heute", yesterday: "Gestern", tomorrow: "Morgen" })[key];

describe("dateFormatRelative", () => {
    it("spells the month in the locale it is given", () => {
        expect(dateFormatRelative(day(2026, 7, 14), { locale: "de", base })).toBe("14. Juli");
        expect(dateFormatRelative(day(2026, 7, 14), { locale: "en-US", base })).toBe("July 14");
        expect(dateFormatRelative(day(2026, 7, 14), { locale: "it", base })).toBe("14 luglio");
    });

    /**
     * The bug that produced a German PDF reading "July 14 – July 31": every report surface formats its
     * period through here, so a locale-blind format leaks English into all three languages.
     */
    it("never falls back to English month names", () => {
        expect(dateFormatRelative(day(2026, 7, 31), { locale: "de", base })).not.toMatch(/July/);
    });

    it("keeps a report period absolute when no translator is passed", () => {
        expect(dateFormatRelative(base, { locale: "de", base })).toBe("03. August");
        expect(dateFormatRelative(day(2026, 8, 2), { locale: "de", base })).toBe("02. August");
    });

    it("uses the relative wording only where a translator asks for it", () => {
        expect(dateFormatRelative(base, { locale: "de", base, t: tDate })).toBe("Heute");
        expect(dateFormatRelative(day(2026, 8, 2), { locale: "de", base, t: tDate })).toBe("Gestern");
        expect(dateFormatRelative(day(2026, 8, 4), { locale: "de", base, t: tDate })).toBe("Morgen");
        expect(dateFormatRelative(day(2026, 7, 14), { locale: "de", base, t: tDate })).toBe("14. Juli");
    });

    it("adds the year once the date leaves the current one", () => {
        expect(dateFormatRelative(day(2025, 12, 20), { locale: "de", base })).toBe("20. Dezember 2025");
    });
});
