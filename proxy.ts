import { NextResponse, type NextRequest } from "next/server";
import { actionLimiter, apiLimiter, checkLimit, clientIp } from "./lib/rate-limit";
import { updateSession } from "./lib/supabase/proxy";

function tooMany(retryAfterSeconds: number) {
    return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
    );
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const ip = clientIp(request.headers.get("x-forwarded-for"));

    // Coarse per-IP cap on API routes (skip cron — it's guarded by CRON_SECRET and runs as bursts).
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/cron/")) {
        const { success, retryAfterSeconds } = await checkLimit(apiLimiter, `api:${ip}`);
        if (!success) return tooMany(retryAfterSeconds);
    }
    // Coarse per-IP cap on mutating server actions (POST carrying Next.js's Next-Action header).
    // This blankets every server action reached through the middleware — account/report/notification
    // mutations, password update, logout. The auth actions (login) also carry their own stricter
    // per-IP limit; admin actions live under /admin (excluded from this matcher) and are gated/limited
    // in their own handlers.
    else if (request.method === "POST" && request.headers.has("next-action")) {
        const { success, retryAfterSeconds } = await checkLimit(actionLimiter, `action:${ip}`);
        if (!success) return tooMany(retryAfterSeconds);
    }

    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - admin (admin pages, handled by their own layout)
         * - manifest.(json|webmanifest), robots.txt, sitemap.xml (public metadata files)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico|admin|manifest\\.(?:json|webmanifest)|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
