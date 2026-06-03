import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { checkEnv } from "./env";

/**
 * Cron routes are public endpoints guarded by a shared secret (Vercel sends `Authorization: Bearer
 * $CRON_SECRET`). Dev skips the check for local testing. checkEnv throws if CRON_SECRET is unset, so
 * a misconfigured deployment fails closed rather than leaving the endpoints open.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
    if (process.env.NODE_ENV === "development") return true;

    const expected = Buffer.from(`Bearer ${checkEnv("CRON_SECRET")}`);
    const provided = Buffer.from(request.headers.get("authorization") ?? "");

    return expected.length === provided.length && timingSafeEqual(expected, provided);
}
