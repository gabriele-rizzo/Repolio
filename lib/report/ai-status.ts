/** How far along a report's AI section is — rendered as a chip on /admin/validation. */
export type ReportAiStatus = "READY" | "GENERATING" | "EMPTY";

export interface ReportAiFields {
    ai_pending: boolean;
    trend_explanation: string | null;
    /** Prisma JSON column — an array of recommendations, or null when generation produced none. */
    recommendations: unknown;
}

/**
 * The single definition of a report's AI state.
 *
 * EMPTY covers both intended cases — a zero-activity period, which never calls the model at all —
 * and a failed generation. Either way the PDF goes out with no AI section, which is what an admin
 * needs to see before approving and exactly what "Exclude all empty" acts on. The validation screen
 * and that bulk action both read this, so the button can never disagree with the chip beside it.
 */
export function reportAiStatus(report: ReportAiFields): ReportAiStatus {
    if (report.ai_pending) return "GENERATING";

    const recommendations = Array.isArray(report.recommendations) ? report.recommendations.length : 0;

    return report.trend_explanation || recommendations > 0 ? "READY" : "EMPTY";
}
