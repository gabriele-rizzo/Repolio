import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkEnv } from "../env";

/** Anyone may see these and everything under them. */
const PUBLIC_PREFIXES = ["/auth", "/privacy", "/terms-of-service", "/admin", "/api", "/data-deletion"];

/**
 * Anyone may see exactly these. Separate from the prefixes because "/" — the landing page — cannot be
 * a prefix: `startsWith("/")` is true of every path in the app, which would make the whole dashboard
 * public.
 */
const PUBLIC_EXACT = ["/"];

function requestNeedsAuth(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (PUBLIC_EXACT.includes(pathname)) return false;

    return !PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({ request });

    const url = checkEnv("NEXT_PUBLIC_SUPABASE_URL");
    const key = checkEnv("NEXT_PUBLIC_SUPABASE_KEY");

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookies, headers) => {
                for (const { name, value } of cookies) request.cookies.set(name, value);

                response = NextResponse.next({ request });

                for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
                for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
            },
        },
    });

    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    if (!user && requestNeedsAuth(request)) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/login";

        return NextResponse.redirect(url);
    }

    return response;
}
