/**
 * Sanitises the `?next=` target of an auth callback down to a same-origin path.
 *
 * `/auth/confirm` finishes by redirecting wherever `next` says, and `next` arrives in a URL that
 * anybody can write — including one mailed to a client. `new URL(next, request.url)` resolves
 * "https://evil.example" and the protocol-relative "//evil.example" to a DIFFERENT ORIGIN, so passing
 * the raw parameter through is an open redirect: a link that starts on our domain, carries a real
 * Supabase token, and lands the visitor somewhere else, having spent their one-time token on the way.
 *
 * The rule is deliberately narrow — a leading "/" followed by something that is not another "/" or a
 * backslash. Backslashes because browsers have historically normalised "/\evil.example" to
 * "//evil.example"; control characters because they have no business in a path and are the raw material
 * of header-splitting tricks. Anything else falls back rather than being repaired: guessing at what a
 * malformed target meant is how these holes reopen.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
    if (!next) return fallback;

    // Escapes, not literal characters: a raw control byte in the source is invisible to review.
    if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;

    if (next === "/") return next;
    if (!/^\/[^/\\]/.test(next)) return fallback;

    return next;
}
