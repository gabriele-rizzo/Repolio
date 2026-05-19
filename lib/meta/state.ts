import { randomBytes } from "crypto";

export const META_STATE_COOKIE = "meta_oauth_state";
export const META_STATE_TTL_SECONDS = 600; // 10 minutes

export function generateState() {
    return randomBytes(32).toString("base64url");
}
