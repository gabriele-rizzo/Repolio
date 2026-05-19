export function userInitials(name: string): string | null {
    const segments = name.split(" ").map((s) => s.trim());
    const initials = segments.map((s) => s.at(0)?.toUpperCase()).filter((c) => typeof c !== "undefined");

    if (initials.length === 0) return null;
    if (initials.length > 2) return `${initials[0]}${initials[initials.length - 1]}`;

    return initials.join("");
}
