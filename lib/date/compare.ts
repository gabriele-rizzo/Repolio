export function compareDate(a: Date | undefined, b: Date, strategy: "min" | "max"): Date | undefined {
    if (typeof a === "undefined") return a;

    if (strategy === "min") return a < b ? a : b;
    return a > b ? a : b;
}
