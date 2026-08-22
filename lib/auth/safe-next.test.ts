import { safeNext } from "./safe-next";
import { describe, expect, it } from "vitest";

// The value under test decides where a visitor holding a valid one-time token gets sent, from a
// parameter anyone can write. Every case below is a redirect somebody would try.

const FALLBACK = "/dashboard";

describe("safeNext", () => {
    it("keeps an ordinary same-origin path", () => {
        expect(safeNext("/dashboard", FALLBACK)).toBe("/dashboard");
        expect(safeNext("/dashboard/reports", FALLBACK)).toBe("/dashboard/reports");
        expect(safeNext("/auth/set-password", FALLBACK)).toBe("/auth/set-password");
        expect(safeNext("/dashboard?tab=reports#top", FALLBACK)).toBe("/dashboard?tab=reports#top");
        expect(safeNext("/", FALLBACK)).toBe("/");
    });

    it("falls back when there is nothing to use", () => {
        expect(safeNext(null, FALLBACK)).toBe(FALLBACK);
        expect(safeNext(undefined, FALLBACK)).toBe(FALLBACK);
        expect(safeNext("", FALLBACK)).toBe(FALLBACK);
    });

    it("refuses another origin", () => {
        // `new URL(value, "https://repolio.example")` resolves every one of these off-origin.
        for (const value of [
            "https://evil.example",
            "http://evil.example/path",
            "//evil.example",
            "///evil.example",
            "\\\\evil.example",
            "/\\evil.example",
            "https:evil.example",
        ]) {
            expect(safeNext(value, FALLBACK)).toBe(FALLBACK);
        }
    });

    it("refuses a scheme that is not a path at all", () => {
        expect(safeNext("javascript:alert(1)", FALLBACK)).toBe(FALLBACK);
        expect(safeNext("data:text/html,<script>", FALLBACK)).toBe(FALLBACK);
        expect(safeNext("mailto:someone@example.com", FALLBACK)).toBe(FALLBACK);
    });

    it("refuses a relative path, which is not obviously ours either", () => {
        expect(safeNext("dashboard", FALLBACK)).toBe(FALLBACK);
        expect(safeNext("../admin", FALLBACK)).toBe(FALLBACK);
    });

    it("refuses control characters", () => {
        // Escaped in the source so the cases stay readable; a raw byte here would be invisible.
        for (const value of ["/dash\nboard", "/dash\rboard", "/dash\tboard", "/dash\u0000board", "/dash\u007fboard"]) {
            expect(safeNext(value, FALLBACK)).toBe(FALLBACK);
        }

        // A space is not a control character and not a redirect trick — it stays.
        expect(safeNext("/dash board", FALLBACK)).toBe("/dash board");
    });

    // Proof that what survives really is same-origin, rather than merely looking like it.
    it("resolves every accepted value back to our own origin", () => {
        const base = "https://repolio.example/auth/confirm";
        const candidates = [
            "/dashboard",
            "/",
            "https://evil.example",
            "//evil.example",
            "/\\evil.example",
            "javascript:alert(1)",
            "../admin",
        ];

        for (const candidate of candidates) {
            const resolved = new URL(safeNext(candidate, FALLBACK), base);
            expect(resolved.origin).toBe("https://repolio.example");
        }
    });
});
