import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiting backed by Upstash Redis — serverless-native (HTTP), works in edge middleware and
// server actions, sliding-window. It is DISABLED until UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set: when either is missing the limiters are null and every check
// passes (fail-open), so local dev and un-provisioned previews keep working. Protection only takes
// effect once both env vars are configured — see the deploy checklist.

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis) {
    console.warn("[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — rate limiting is DISABLED.");
}

function makeLimiter(tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
    return redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(tokens, window), prefix, analytics: false }) : null;
}

/** Strict, per-IP: unauthenticated auth attempts (login, admin OTP) — brute-force defense. */
export const authLimiter = makeLimiter(5, "15 m", "rl:auth");

/**
 * Global (all IPs combined) cap on admin login attempts — layered on top of the per-IP `authLimiter` to
 * defend against brute force spread across rotating IPs. A single admin won't fail this many times
 * legitimately; the trade-off is that a flood could briefly lock out the admin login (acceptable — admin
 * login is rare, and unlimited guessing at a static password is the worse outcome).
 */
export const otpGlobalLimiter = makeLimiter(30, "15 m", "rl:otp-global");

/** Coarse, per-IP: blanket cap on public / expensive API routes (applied in the middleware). */
export const apiLimiter = makeLimiter(60, "1 m", "rl:api");

/** Coarse, per-IP: blanket cap on mutating server actions (applied in the middleware). */
export const actionLimiter = makeLimiter(30, "1 m", "rl:action");

export interface LimitOutcome {
    success: boolean;
    retryAfterSeconds: number;
}

/** Runs `limiter` for `identifier`. A null limiter (Upstash not configured) always passes. */
export async function checkLimit(limiter: Ratelimit | null, identifier: string): Promise<LimitOutcome> {
    if (!limiter) return { success: true, retryAfterSeconds: 0 };
    const { success, reset } = await limiter.limit(identifier);
    return { success, retryAfterSeconds: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
}

/** The client IP from an `X-Forwarded-For` header value (first hop); "unknown" when absent. */
export function clientIp(forwardedFor: string | null): string {
    return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
