import { safeNext } from "@/lib/auth/safe-next";
import { mirrorClientLocale } from "@/lib/i18n/mirror-locale";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Where every emailed token is spent: the invite an admin sends, and the magic link a client requests
// for themselves. Both arrive as `token_hash` + `type` and leave with a session.
//
// The default target stays /auth/set-password because that is what an INVITE needs — a new client has
// no password yet. The magic link overrides it with ?next=/dashboard, since that client already has an
// account and only wanted in.

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;

    // `next` comes out of a URL anyone can write, including one mailed to a client, and it is about to
    // be resolved against our own origin — see lib/auth/safe-next.ts for why that is an open redirect
    // if taken literally.
    const next = safeNext(searchParams.get("next"), "/auth/set-password");

    if (!token_hash || !type) {
        const error = encodeURIComponent("The access token was missing in your URL.");
        const url = new URL(`/auth/login?error=${error}`, request.url);

        return NextResponse.redirect(url);
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (error) {
        const message = encodeURIComponent(error.message);
        const url = new URL(`/auth/login?error=${message}`, request.url);

        return NextResponse.redirect(url);
    }

    // This route now signs people in, so it owes them what the password form does: their own language
    // in the cookie, and a re-detection for clients whose language follows their browser. Best-effort —
    // the session already exists by here, and a locale that lags one page load is not worth failing a
    // login over.
    if (data.user) await mirrorClientLocale(data.user.id);

    return NextResponse.redirect(new URL(next, request.url));
}
