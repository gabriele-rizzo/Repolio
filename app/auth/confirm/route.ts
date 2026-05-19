import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const next = searchParams.get("next") ?? "/auth/set-password";

    if (!token_hash || !type) {
        const error = encodeURIComponent("The access token was missing in your URL.");
        const url = new URL(`/login?error=${error}`, request.url);

        return NextResponse.redirect(url);
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (error) {
        const message = encodeURIComponent(error.message);
        const url = new URL(`/login?error=${message}`, request.url);

        return NextResponse.redirect(url);
    }

    return NextResponse.redirect(new URL(next, request.url));
}
