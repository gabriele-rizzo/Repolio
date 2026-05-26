import { startOfDay } from "./start-of-day";

export function dateFormatRelative(input: Date, base: Date = new Date()): string {
    const date = new Date(input);

    const a = startOfDay(date);
    const b = startOfDay(base);

    const diffMs = a.getTime() - b.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === -1) return "Yesterday";
    if (diffDays === 1) return "Tomorrow";

    const year = a.getFullYear() === b.getFullYear() ? undefined : "numeric";

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "long",
        year,
    });
}
