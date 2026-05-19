import { Secret, TOTP } from "@otp-lib/authenticator";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { checkEnv } from "../env";

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const authenticator = new TOTP({
    account: "admin",
    issuer: "Repolio",
    secret: Secret.fromBase32(checkEnv("TOTP_SECRET")),
    digits: 6,
});

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

export async function verifyOTP(code: string): Promise<boolean> {
    return await authenticator.verify(code);
}
