"use server";

import { safeAction } from "@/lib/action";
import { checkEnv } from "@/lib/env";
import { authLimiter, checkLimit, clientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import * as z from "zod";

/** Bounded and normalised for the same reasons as the access-request form: this is a public endpoint. */
const schema = z.object({
    email: z
        .string()
        .trim()
        .max(254)
        .email()
        .transform((value) => value.toLowerCase()),
});

export type MagicLinkInput = z.infer<typeof schema>;

export async function sendMagicLink(input: MagicLinkInput) {
    const ip = clientIp((await headers()).get("x-forwarded-for"));

    // Two buckets, because there are two different abuses. Per IP is the ordinary brute-force cap. Per
    // ADDRESS is the one specific to emailing a link on request: without it, anyone cycling through
    // proxies can have us mail a known client's inbox as often as they like, and the client sees a
    // stream of login mail they never asked for.
    const perIp = await checkLimit(authLimiter, `magic-link:${ip}`);
    if (!perIp.success) return { error: `Too many requests. Please try again in ${perIp.retryAfterSeconds}s.` };

    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: "Enter a valid email address." };

    const { email } = parsed.data;

    const perEmail = await checkLimit(authLimiter, `magic-link-to:${email}`);
    if (!perEmail.success) return { error: `Too many requests. Please try again in ${perEmail.retryAfterSeconds}s.` };

    return safeAction(async () => {
        const supabase = await createClient();
        const baseUrl = checkEnv("NEXT_PUBLIC_SITE_URL");

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                // THE IMPORTANT LINE. Left at its default of `true`, this endpoint is open self-signup:
                // anyone typing any address gets a working login link, Supabase creates the auth user,
                // and the trigger on auth.users creates a Client row from metadata that does not exist —
                // a nameless client nobody enrolled. Every account here is created by an admin, either
                // through /admin/enrollment or by accepting a request, and this keeps it that way.
                shouldCreateUser: false,
                emailRedirectTo: `${baseUrl}/auth/confirm?next=/dashboard`,
            },
        });

        // Deliberately swallowed. With `shouldCreateUser: false` Supabase reports an unknown address as
        // an error, so surfacing it would turn this box into a client-list oracle: type an address, learn
        // whether that agency is a customer. The caller always renders "check your inbox", and the real
        // reason — unknown address, provider outage, Supabase's own rate limit — goes to the log.
        if (error) console.error(`Magic link not sent to ${email}:`, error.message);
    });
}
