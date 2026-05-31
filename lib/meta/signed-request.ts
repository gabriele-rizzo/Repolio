import { createHmac, timingSafeEqual } from "crypto";
import { checkEnv } from "../env";

interface SignedRequestPayload {
    algorithm?: string;
    issued_at?: number;
    user_id?: string;
    [key: string]: unknown;
}

/**
 * Verifies and decodes a Meta `signed_request` (sent to the deauthorize and
 * data-deletion callbacks). Returns the payload only when the HMAC-SHA256
 * signature matches our app secret, otherwise null.
 */
export function parseSignedRequest(signedRequest: string): SignedRequestPayload | null {
    const [encodedSig, payload] = signedRequest.split(".");
    if (!encodedSig || !payload) return null;

    const expected = createHmac("sha256", checkEnv("META_APP_SECRET")).update(payload).digest();
    const provided = Buffer.from(encodedSig, "base64url");

    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

    try {
        const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedRequestPayload;
        return data.algorithm?.toUpperCase() === "HMAC-SHA256" ? data : null;
    } catch {
        return null;
    }
}
