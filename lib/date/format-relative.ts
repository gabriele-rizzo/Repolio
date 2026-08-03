import { startOfDay } from "./start-of-day";

/** The three days that have a word instead of a date. */
export type RelativeDayKey = "today" | "yesterday" | "tomorrow";

export interface RelativeDateOptions {
    /**
     * BCP-47 tag the month name is spelled in. Required rather than defaulted: this function feeds
     * client-facing reports in three languages, and a hard-coded fallback is how a German report came
     * to print its period as "July 14 – July 31".
     */
    locale: string;
    /**
     * Resolves the today/yesterday/tomorrow wording. Supply it for dashboard timestamps, where the
     * relative phrasing is what a reader wants. Omit it — as every report surface does — to always
     * print the calendar date: a report period reading "14. Juli – Gestern" is not a period, and the
     * words also go stale the moment the document is read a day later.
     */
    t?: (key: RelativeDayKey) => string;
    base?: Date;
}

export function dateFormatRelative(input: Date, { locale, t, base = new Date() }: RelativeDateOptions): string {
    const date = new Date(input);

    const a = startOfDay(date);
    const b = startOfDay(base);

    const diffMs = a.getTime() - b.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (t) {
        if (diffDays === 0) return t("today");
        if (diffDays === -1) return t("yesterday");
        if (diffDays === 1) return t("tomorrow");
    }

    const year = a.getFullYear() === b.getFullYear() ? undefined : "numeric";

    return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "long",
        year,
    });
}
