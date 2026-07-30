import {
    createSessionToken,
    MIN_ADMIN_PASSWORD_LENGTH,
    verifyAdminPassword,
    verifySessionToken,
} from "@/lib/admin/auth";
import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const GOOD_PASSWORD = "correct-horse-battery-staple-42";

beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.ADMIN_PASSWORD = GOOD_PASSWORD;
});

afterEach(() => {
    delete process.env.SESSION_SECRET;
    delete process.env.ADMIN_PASSWORD;
});

describe("verifyAdminPassword", () => {
    it("accepts the configured password", async () => {
        await expect(verifyAdminPassword(GOOD_PASSWORD)).resolves.toBe(true);
    });

    it("rejects a wrong password", async () => {
        await expect(verifyAdminPassword("nope")).resolves.toBe(false);
    });

    /**
     * timingSafeEqual throws on differing lengths, so comparing the raw strings would crash on most
     * wrong guesses AND leak the real password's length through that difference. Digests are always
     * 32 bytes, so any length of guess must return cleanly.
     */
    it("returns false rather than throwing for a guess of any length", async () => {
        for (const guess of ["", "a", "x".repeat(5000), `${GOOD_PASSWORD}x`, GOOD_PASSWORD.slice(0, -1)]) {
            await expect(verifyAdminPassword(guess)).resolves.toBe(false);
        }
    });

    it("is case- and whitespace-sensitive", async () => {
        await expect(verifyAdminPassword(GOOD_PASSWORD.toUpperCase())).resolves.toBe(false);
        await expect(verifyAdminPassword(` ${GOOD_PASSWORD}`)).resolves.toBe(false);
    });

    it("refuses to authenticate at all when the configured password is too short", async () => {
        process.env.ADMIN_PASSWORD = "short";
        // Fails loudly on a misconfigured deployment rather than quietly accepting a weak secret —
        // and refuses even when the guess is correct.
        await expect(verifyAdminPassword("short")).rejects.toThrow(/at least 16 characters/);
    });

    it("accepts a password exactly at the minimum length", async () => {
        const exact = "a".repeat(MIN_ADMIN_PASSWORD_LENGTH);
        process.env.ADMIN_PASSWORD = exact;
        await expect(verifyAdminPassword(exact)).resolves.toBe(true);
    });

    it("throws when ADMIN_PASSWORD is unset, rather than admitting everyone", async () => {
        delete process.env.ADMIN_PASSWORD;
        await expect(verifyAdminPassword("anything")).rejects.toThrow(/ADMIN_PASSWORD/);
    });

    it("throws when ADMIN_PASSWORD is empty", async () => {
        process.env.ADMIN_PASSWORD = "";
        await expect(verifyAdminPassword("")).rejects.toThrow(/ADMIN_PASSWORD/);
    });
});

describe("session token", () => {
    it("round-trips a freshly issued token", () => {
        expect(verifySessionToken(createSessionToken())).toBe(true);
    });

    it("rejects junk", () => {
        for (const token of [undefined, "", "no-dot", "a.b", "..", "9999999999."]) {
            expect(verifySessionToken(token as string | undefined)).toBe(false);
        }
    });

    it("rejects a tampered expiry, since the signature covers it", () => {
        const [, signature] = createSessionToken().split(".");
        const forged = `${Math.floor(Date.now() / 1000) + 999_999}.${signature}`;
        expect(verifySessionToken(forged)).toBe(false);
    });

    it("rejects a token signed with a different secret", () => {
        const token = createSessionToken();
        process.env.SESSION_SECRET = "a-different-secret";
        expect(verifySessionToken(token)).toBe(false);
    });

    it("rejects an expired token even when correctly signed", () => {
        // Signed by the real signer, but dated in the past.
        const past = String(Math.floor(Date.now() / 1000) - 60);
        const valid = createSessionToken();
        const [payload] = valid.split(".");
        expect(payload > past).toBe(true);

        // Re-sign the past payload the same way createSessionToken would.
        const signature = createHmac("sha256", process.env.SESSION_SECRET as string).update(past).digest("hex");
        expect(verifySessionToken(`${past}.${signature}`)).toBe(false);
    });
});
