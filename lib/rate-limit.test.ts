import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// lib/rate-limit.ts decides fail-open vs fail-closed at MODULE LOAD, so each case needs a fresh import
// with the environment already staged. That load-time decision is the point: a deployment cannot get
// half-way to serving traffic with rate limiting quietly switched off.

const UPSTASH = {
    UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "upstash-token",
};

function stage(env: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) vi.stubEnv(key, undefined as unknown as string);
        else vi.stubEnv(key, value);
    }
}

beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe("production without Upstash", () => {
    it("refuses to load rather than silently disabling every limit", async () => {
        stage({ NODE_ENV: "production", ...{ UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined } });

        // This is the regression being locked: the previous behaviour was a console.warn and a null
        // limiter, so brute-force defence on admin login vanished while the deployment looked healthy.
        await expect(import("@/lib/rate-limit")).rejects.toThrow(/Refusing to serve production traffic unprotected/);
    });

    it("also refuses when only one of the pair is set", async () => {
        stage({ NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://redis.upstash.io", UPSTASH_REDIS_REST_TOKEN: undefined });

        await expect(import("@/lib/rate-limit")).rejects.toThrow(/rate limiting is DISABLED/);
    });
});

describe("production with Upstash", () => {
    it("loads and builds real limiters", async () => {
        stage({ NODE_ENV: "production", ...UPSTASH });

        const mod = await import("@/lib/rate-limit");
        expect(mod.authLimiter).not.toBeNull();
        expect(mod.apiLimiter).not.toBeNull();
        expect(mod.actionLimiter).not.toBeNull();
        expect(mod.otpGlobalLimiter).not.toBeNull();
    });
});

describe("outside production without Upstash", () => {
    it("loads with limiters disabled, so local dev and previews keep working", async () => {
        stage({ NODE_ENV: "development", UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const mod = await import("@/lib/rate-limit");

        expect(mod.authLimiter).toBeNull();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("rate limiting is DISABLED"));
        warn.mockRestore();
    });

    it("passes every check when the limiter is disabled", async () => {
        stage({ NODE_ENV: "development", UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined });
        vi.spyOn(console, "warn").mockImplementation(() => {});

        const { checkLimit } = await import("@/lib/rate-limit");
        expect(await checkLimit(null, "any-identifier")).toEqual({ success: true, retryAfterSeconds: 0 });
    });
});

describe("clientIp", () => {
    it("takes the first hop of X-Forwarded-For and falls back when absent", async () => {
        stage({ NODE_ENV: "development", UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined });
        vi.spyOn(console, "warn").mockImplementation(() => {});

        const { clientIp } = await import("@/lib/rate-limit");

        expect(clientIp("203.0.113.7, 70.41.3.18, 150.172.238.178")).toBe("203.0.113.7");
        expect(clientIp("  203.0.113.7  ")).toBe("203.0.113.7");
        expect(clientIp(null)).toBe("unknown");
        expect(clientIp("")).toBe("unknown");
    });
});
