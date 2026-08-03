import { describe, expect, it } from "vitest";
import { reportAiStatus } from "./ai-status";

// The states an admin acts on: GENERATING must never be treated as empty (its text is still in
// flight), and a report is only EMPTY when it would reach the client with no AI section at all.

const report = (fields: Partial<Parameters<typeof reportAiStatus>[0]>) => ({
    ai_pending: false,
    trend_explanation: null,
    recommendations: null,
    ...fields,
});

describe("reportAiStatus", () => {
    it("reports an in-flight generation as GENERATING, whatever it currently holds", () => {
        expect(reportAiStatus(report({ ai_pending: true }))).toBe("GENERATING");
        expect(reportAiStatus(report({ ai_pending: true, trend_explanation: "Spend fell 12%." }))).toBe("GENERATING");
    });

    it("reports READY on either half of the AI section", () => {
        expect(reportAiStatus(report({ trend_explanation: "Spend fell 12%." }))).toBe("READY");
        expect(reportAiStatus(report({ recommendations: [{ title: "Cut the losing ad set" }] }))).toBe("READY");
    });

    it("reports EMPTY when nothing was written", () => {
        expect(reportAiStatus(report({}))).toBe("EMPTY");
        expect(reportAiStatus(report({ recommendations: [] }))).toBe("EMPTY");
        // A generation that returned an empty string is a failure, not a write-up.
        expect(reportAiStatus(report({ trend_explanation: "" }))).toBe("EMPTY");
    });
});
