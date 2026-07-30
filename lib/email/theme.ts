import type { ScoreLabel } from "@/generated/prisma/browser";

// Shared palette for the offline report surfaces — the HTML email and the PDF attachment. Neither
// loads Tailwind or theme CSS, so both need literal values, and both must look like the same
// document: neutral scale, square corners (the app uses --radius: 0), purple accents on
// AI-generated sections. Kept here so the two renderers can't drift apart.

export const ink = "#0a0a0a"; // foreground
export const bodyText = "#404040"; // neutral-700
export const muted = "#737373"; // muted-foreground
export const border = "#e5e5e5"; // border
export const pageBg = "#fafafa";
export const white = "#ffffff";
export const primary = "#171717"; // primary (dark)
export const primaryFg = "#fafafa";
export const accent = "#7e22ce"; // purple-700, used for AI-generated sections

export const positive = "#15803d";
export const negative = "#b91c1c";

export const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const SCORE_LABEL_STYLE: Record<ScoreLabel, { color: string; bg: string }> = {
    STRONG: { color: "#15803d", bg: "#f0fdf4" },
    MODERATE: { color: "#b45309", bg: "#fffbeb" },
    NEEDS_IMPROVEMENT: { color: "#b91c1c", bg: "#fef2f2" },
};

export const PRIORITY_STYLE: Record<string, { color: string; bg: string; rail: string }> = {
    IMMEDIATE: { color: "#b91c1c", bg: "#fef2f2", rail: "#ef4444" },
    THIS_WEEK: { color: "#b45309", bg: "#fffbeb", rail: "#f59e0b" },
    MONITOR: { color: "#1d4ed8", bg: "#eff6ff", rail: "#3b82f6" },
};

export const priorityStyle = (priority: string) =>
    PRIORITY_STYLE[priority] ?? { color: muted, bg: "#f5f5f5", rail: muted };

/** Colour for a period-over-period delta. `good` is null when the metric has no better direction. */
export const deltaColor = (good: boolean | null): string => (good == null ? muted : good ? positive : negative);
