// Runs once when a server instance starts, before it serves anything.
//
// This is the only place the app gets a real "boot": Next has no other hook that runs ahead of the
// first request. Validating the environment here is what turns a missing variable from a 500 at the
// worst possible moment — RESEND_API_KEY absent is discovered when an admin clicks "Validate & send" —
// into a deployment that refuses to start and says exactly what is missing.
export async function register() {
    // Node runtime only. The edge runtime (the proxy) has a different, much smaller env, and asserting
    // the server manifest there would fail on variables it is never given. Edge-side rate limiting has
    // its own production guard — see lib/rate-limit.ts. Imported dynamically so this module's
    // dependencies stay out of the edge bundle entirely.
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const { assertEnv } = await import("./lib/env");
    assertEnv();
}
