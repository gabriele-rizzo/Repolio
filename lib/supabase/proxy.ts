import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkEnv } from "../env";

const PUBLIC_PATHS = ["/auth", "/privacy", "/terms-of-service", "/admin", "/api", "/data-deletion"];

function requestNeedsAuth(request: NextRequest) {
    return !PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
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
