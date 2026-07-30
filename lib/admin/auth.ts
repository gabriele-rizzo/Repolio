import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { checkEnv } from "../env";

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

/**
 * Admin authentication: a single shared password from `ADMIN_PASSWORD`, exchanged for an HMAC-signed
 * session cookie.
 *
 * This replaced a rotating TOTP code, which is a real reduction in strength: the secret is now static,
 * long-lived, and lives wherever env vars live. What guards it instead is length (below), constant-time
 * comparison, and the per-IP + global rate limits in `actions/admin/verify.ts` — those matter MORE than
 * they did under TOTP, because a static password stays valid until someone rotates it.
 *
 * The password is compared in plaintext rather than against a stored hash on purpose: anyone who can
 * read `ADMIN_PASSWORD` can also read `SESSION_SECRET` and forge a session cookie outright, so hashing
 * would add a dependency and latency without changing what an env-var leak costs.
 */

/**
 * Minimum length for `ADMIN_PASSWORD`. This one secret opens every client's data and the ability to
 * email them, and it never rotates — so a guessable value is refused outright rather than warned about.
 * Generate one with `openssl rand -base64 24`.
 */
export const MIN_ADMIN_PASSWORD_LENGTH = 16;

function sign(payload: string) {
    const secret = checkEnv("SESSION_SECRET");

    return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionToken() {
    const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
    const payload = String(expiresAt);

    return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
    if (typeof token === "undefined") return false;

    const [payload, signed] = token.split(".");
    if (!payload || !signed) return false;

    const expected = sign(payload);
    const a = Buffer.from(signed, "hex");
    const b = Buffer.from(expected, "hex");

    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    return Number(payload) > Math.floor(Date.now() / 1000);
}

export async function isAdminAuthenticated() {
    const store = await cookies();
    const token = store.get(ADMIN_COOKIE_NAME)?.value;

    return verifySessionToken(token);
}

/**
 * Checks a submitted admin password.
 *
 * Compares SHA-256 digests rather than the strings: `timingSafeEqual` throws on differing lengths, and
 * comparing raw input would both crash on a wrong-length guess and leak the real password's length
 * through that difference. Digests are always 32 bytes, so every comparison takes the same path.
 *
 * Throws — rather than returning false — when the configured password is missing or too short, so a
 * misconfigured deployment fails loudly at the login attempt instead of quietly accepting a weak secret.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
    const expected = checkEnv("ADMIN_PASSWORD");

    if (expected.length < MIN_ADMIN_PASSWORD_LENGTH) {
        throw new Error(
            `ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters. Admin access is disabled until it is.`,
        );
    }

    const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

    return timingSafeEqual(digest(password), digest(expected));
}
