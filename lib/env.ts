// The single description of what this app needs in its environment.
//
// DELIBERATELY IMPORT-FREE. `prisma.config.ts` imports this module, so it is loaded by the Prisma CLI
// under plain Node with no bundler, no path aliases and no Next runtime. It is also reached from edge
// code. Any import added here has to work in all three; none is worth that, so there are none.

/**
 * Minimum length for the shared admin password.
 *
 * Lives here, with the rest of env policy, and is re-exported by lib/admin/auth.ts (which cannot own it
 * without this module importing `next/headers` transitively). Guards a secret that is static and
 * long-lived — see the note in lib/admin/auth.ts.
 */
export const MIN_ADMIN_PASSWORD_LENGTH = 16;

type Requirement =
    /** Absent means the app cannot function, in any environment. */
    | "always"
    /** Absent is tolerable locally, but a production deployment without it is misconfigured. */
    | "production"
    /** Has a working built-in default; listed so it is documented rather than folklore. */
    | "optional";

export interface EnvSpec {
    key: string;
    requiredIn: Requirement;
    /** One line, printed in the boot failure and mirrored into .env.example. */
    description: string;
    /** Checked only when the value is present. Returns a problem, or null when fine. */
    validate?: (value: string) => string | null;
}

const url = (value: string): string | null => {
    try {
        new URL(value);
        return null;
    } catch {
        return "must be an absolute URL (including the scheme)";
    }
};

/**
 * Every variable the app reads, and how badly it needs each one.
 *
 * The point of gathering them is `assertEnv` below: before this existed, `checkEnv` threw at the moment
 * of USE, so a missing RESEND_API_KEY surfaced as a 500 during batch validation — the click that emails
 * a client their reports — rather than at deploy. One list also means the failure names everything
 * missing at once instead of one variable per restart, and .env.example can be checked against it
 * (lib/env.test.ts) so the documentation cannot drift.
 */
export const ENV_MANIFEST: readonly EnvSpec[] = [
    // --- Database (Supabase Postgres) ---
    { key: "DATABASE_URL", requiredIn: "always", description: "Postgres connection string used by the app (pooled)." },
    { key: "DIRECT_URL", requiredIn: "always", description: "Direct (unpooled) Postgres URL, used by Prisma migrations." },

    // --- Supabase auth ---
    { key: "NEXT_PUBLIC_SUPABASE_URL", requiredIn: "always", description: "Supabase project URL.", validate: url },
    { key: "NEXT_PUBLIC_SUPABASE_KEY", requiredIn: "always", description: "Supabase anon/publishable key, safe for the browser." },
    {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        requiredIn: "always",
        description: "Supabase service-role key. Server-only — it bypasses row-level security.",
    },

    // --- App identity ---
    {
        key: "NEXT_PUBLIC_SITE_URL",
        requiredIn: "always",
        description: "Public origin, used to build OAuth callback and email links.",
        validate: url,
    },

    // --- Admin surface ---
    {
        key: "ADMIN_PASSWORD",
        requiredIn: "always",
        description: `Shared admin password (min ${MIN_ADMIN_PASSWORD_LENGTH} characters).`,
        validate: (v) =>
            v.length < MIN_ADMIN_PASSWORD_LENGTH ? `must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters` : null,
    },
    { key: "SESSION_SECRET", requiredIn: "always", description: "HMAC key signing the admin session cookie." },

    // --- Scheduled jobs ---
    { key: "CRON_SECRET", requiredIn: "always", description: "Bearer token Vercel Cron presents to /api/cron/*." },

    // --- Third parties ---
    { key: "ANTHROPIC_API_KEY", requiredIn: "always", description: "Anthropic key for the report-writing Batches API." },
    { key: "ZERNIO_API_KEY", requiredIn: "always", description: "Zernio key — the gateway holding every ad-platform token." },
    { key: "RESEND_API_KEY", requiredIn: "always", description: "Resend key for transactional email." },

    // --- Rate limiting: required in production, see the note in lib/rate-limit.ts ---
    {
        key: "UPSTASH_REDIS_REST_URL",
        requiredIn: "production",
        description: "Upstash Redis REST URL. Without it ALL rate limiting is disabled.",
        validate: url,
    },
    {
        key: "UPSTASH_REDIS_REST_TOKEN",
        requiredIn: "production",
        description: "Upstash Redis REST token. Without it ALL rate limiting is disabled.",
    },

    // --- Optional: documented so the defaults are discoverable ---
    { key: "RESEND_FROM", requiredIn: "optional", description: "Sender for outgoing email. Defaults to the built-in address." },
    { key: "ZERNIO_API_BASE", requiredIn: "optional", description: "Zernio API base URL. Defaults to the production endpoint." },
    { key: "ZERNIO_FETCH_CONCURRENCY", requiredIn: "optional", description: "Concurrent Zernio timeline fetches. Default 20." },
    { key: "SNAPSHOT_UPSERT_CONCURRENCY", requiredIn: "optional", description: "Concurrent per-day snapshot upserts. Default 10." },
    { key: "CRON_BUDGET_MS", requiredIn: "optional", description: "Wall clock a cron run may spend starting work. Default 54000." },
    { key: "POLL_RESERVE_MS", requiredIn: "optional", description: "Wall clock the snapshot phase leaves for reports. Default 20000." },
];

const present = (value: string | undefined): value is string => typeof value !== "undefined" && value !== "";

/** True when this process is serving production traffic. */
export const isProduction = (env: NodeJS.ProcessEnv = process.env): boolean => env.NODE_ENV === "production";

/**
 * Reads one required variable, throwing if it is missing.
 *
 * Kept as-is for the ~20 existing call sites: it stays the guard at the point of use, for the runtimes
 * `assertEnv` never runs in and for anything that slipped past it. `assertEnv` is what makes it stop
 * being the FIRST place a misconfiguration is noticed.
 */
export function checkEnv(key: string) {
    const value = process.env[key];

    if (!present(value)) {
        throw new Error(`A value for the environment key '${key}' was not found`);
    }

    return value;
}

/** Everything wrong with `env`, as human-readable lines. Empty means the environment is usable. */
export function envProblems(env: NodeJS.ProcessEnv = process.env): string[] {
    const problems: string[] = [];

    for (const spec of ENV_MANIFEST) {
        const value = env[spec.key];

        if (!present(value)) {
            // `optional` has a default, and `production` requirements do not apply outside production.
            if (spec.requiredIn === "always" || (spec.requiredIn === "production" && isProduction(env))) {
                problems.push(`${spec.key} is missing — ${spec.description}`);
            }
            continue;
        }

        const problem = spec.validate?.(value);
        if (problem) problems.push(`${spec.key} ${problem} — ${spec.description}`);
    }

    return problems;
}

/**
 * Fails the process if the environment cannot support the app. Called once from instrumentation.ts, so
 * a bad deployment dies at startup with the full list rather than half-working until it reaches the one
 * code path that needed the missing key.
 *
 * Values are never echoed — only names — because this message lands in deploy logs.
 */
export function assertEnv(env: NodeJS.ProcessEnv = process.env): void {
    const problems = envProblems(env);
    if (problems.length === 0) return;

    throw new Error(
        `Environment is not usable — ${problems.length} problem(s) found:\n` +
            problems.map((p) => `  • ${p}`).join("\n") +
            "\n\nSee .env.example for what each variable is for.",
    );
}
