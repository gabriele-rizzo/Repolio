import { assertEnv, ENV_MANIFEST, envProblems, isProduction, MIN_ADMIN_PASSWORD_LENGTH } from "@/lib/env";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A valid environment, used as the baseline that individual cases break in one specific way.
const VALID: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://u:p@db.example.com:5432/app",
    DIRECT_URL: "postgresql://u:p@db.example.com:5432/app",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    NEXT_PUBLIC_SITE_URL: "https://repolio.example.com",
    ADMIN_PASSWORD: "a".repeat(MIN_ADMIN_PASSWORD_LENGTH),
    SESSION_SECRET: "session-secret",
    CRON_SECRET: "cron-secret",
    ANTHROPIC_API_KEY: "sk-ant-x",
    ZERNIO_API_KEY: "zernio-key",
    RESEND_API_KEY: "re_x",
    UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "upstash-token",
};

const env = (over: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({ ...VALID, ...over });

describe("envProblems", () => {
    it("finds nothing wrong with a complete production environment", () => {
        expect(envProblems(env())).toEqual([]);
    });

    it("reports every missing variable at once, not just the first", () => {
        // The reason the manifest exists: one restart per missing variable is a terrible way to learn
        // what a deployment needs.
        const problems = envProblems(env({ RESEND_API_KEY: undefined, CRON_SECRET: undefined, ZERNIO_API_KEY: undefined }));

        expect(problems).toHaveLength(3);
        expect(problems.join("\n")).toContain("RESEND_API_KEY is missing");
        expect(problems.join("\n")).toContain("CRON_SECRET is missing");
        expect(problems.join("\n")).toContain("ZERNIO_API_KEY is missing");
    });

    it("treats an empty string as missing", () => {
        // A declared-but-blank variable is the common shape of this mistake in a dashboard UI.
        expect(envProblems(env({ ANTHROPIC_API_KEY: "" }))).toEqual([
            expect.stringContaining("ANTHROPIC_API_KEY is missing"),
        ]);
    });

    it("explains what each missing variable was for", () => {
        const [problem] = envProblems(env({ ZERNIO_API_KEY: undefined }));
        expect(problem).toContain("gateway holding every ad-platform token");
    });

    it("never echoes a value, only its name", () => {
        const secret = "hunter2-hunter2-hunter2";
        const problems = envProblems(env({ ADMIN_PASSWORD: secret, NEXT_PUBLIC_SITE_URL: "not-a-url" }));

        // These messages land in deploy logs.
        expect(problems.join("\n")).not.toContain(secret);
        expect(problems.join("\n")).not.toContain("not-a-url");
    });
});

describe("production-only requirements", () => {
    it("demands the Upstash pair in production", () => {
        const problems = envProblems(env({ UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined }));

        expect(problems).toHaveLength(2);
        expect(problems.join("\n")).toContain("ALL rate limiting is disabled");
    });

    it("tolerates the Upstash pair being absent outside production", () => {
        // Local dev and un-provisioned previews must keep working.
        const problems = envProblems(
            env({ NODE_ENV: "development", UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined }),
        );

        expect(problems).toEqual([]);
    });

    it("still demands the always-required keys outside production", () => {
        expect(envProblems(env({ NODE_ENV: "development", DATABASE_URL: undefined }))).toEqual([
            expect.stringContaining("DATABASE_URL is missing"),
        ]);
    });
});

describe("validators", () => {
    it("rejects an admin password below the minimum length", () => {
        const short = "a".repeat(MIN_ADMIN_PASSWORD_LENGTH - 1);
        expect(envProblems(env({ ADMIN_PASSWORD: short }))).toEqual([
            expect.stringContaining(`must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`),
        ]);
        expect(envProblems(env({ ADMIN_PASSWORD: "a".repeat(MIN_ADMIN_PASSWORD_LENGTH) }))).toEqual([]);
    });

    it("rejects a URL without a scheme", () => {
        expect(envProblems(env({ NEXT_PUBLIC_SITE_URL: "repolio.example.com" }))).toEqual([
            expect.stringContaining("must be an absolute URL"),
        ]);
    });

    it("does not run validators on an absent optional variable", () => {
        expect(envProblems(env({ ZERNIO_API_BASE: undefined }))).toEqual([]);
    });

    it("does validate an optional variable that IS set", () => {
        // Optional means "has a default", not "unchecked" — a typo'd override should still be caught.
        const specs = ENV_MANIFEST.filter((s) => s.requiredIn === "optional" && s.validate);
        for (const spec of specs) {
            expect(envProblems(env({ [spec.key]: "!!!" })).length).toBeGreaterThan(0);
        }
    });
});

describe("assertEnv", () => {
    it("stays silent when the environment is usable", () => {
        expect(() => assertEnv(env())).not.toThrow();
    });

    it("throws one error listing every problem", () => {
        // Problems come out in manifest order, not the order they were broken in, so assert on
        // membership rather than sequence.
        let message = "";
        try {
            assertEnv(env({ RESEND_API_KEY: undefined, SESSION_SECRET: undefined }));
        } catch (error) {
            message = String(error);
        }

        expect(message).toContain("2 problem(s) found");
        expect(message).toContain("RESEND_API_KEY is missing");
        expect(message).toContain("SESSION_SECRET is missing");
    });

    it("points the reader at the template", () => {
        expect(() => assertEnv(env({ CRON_SECRET: undefined }))).toThrowError(/\.env\.example/);
    });
});

describe("isProduction", () => {
    it("is true only for NODE_ENV=production", () => {
        expect(isProduction({ NODE_ENV: "production" })).toBe(true);
        expect(isProduction({ NODE_ENV: "development" })).toBe(false);
        expect(isProduction({ NODE_ENV: "test" })).toBe(false);
        // Next's ProcessEnv types NODE_ENV as required, so an unset one needs the cast.
        expect(isProduction({ NODE_ENV: undefined } as unknown as NodeJS.ProcessEnv)).toBe(false);
    });
});

describe(".env.example", () => {
    const example = readFileSync(".env.example", "utf8");
    const documented = new Set(
        example
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith("#"))
            .map((line) => line.split("=")[0].trim()),
    );

    it("documents exactly the manifest's keys — no more, no less", () => {
        // The whole point of committing a template: it is the only record of what the app needs, so it
        // must not be able to drift from the code that reads them.
        const declared = new Set(ENV_MANIFEST.map((s) => s.key));

        expect([...documented].filter((k) => !declared.has(k))).toEqual([]);
        expect([...declared].filter((k) => !documented.has(k))).toEqual([]);
    });

    it("marks every required key as required", () => {
        for (const spec of ENV_MANIFEST.filter((s) => s.requiredIn !== "optional")) {
            // The line(s) immediately above the key should say so.
            const index = example.indexOf(`\n${spec.key}=`);
            expect(index, `${spec.key} not found in .env.example`).toBeGreaterThan(-1);
            expect(example.slice(0, index).toUpperCase()).toMatch(/REQUIRED[^\n]*$|REQUIRED[\s\S]{0,400}$/);
        }
    });

    it("holds no secrets — every required key is left blank", () => {
        for (const spec of ENV_MANIFEST.filter((s) => s.requiredIn !== "optional")) {
            const match = example.match(new RegExp(`^${spec.key}=(.*)$`, "m"));
            expect(match, `${spec.key} not found`).not.toBeNull();
            // NEXT_PUBLIC_SITE_URL carries a localhost default, which is not a secret.
            if (spec.key !== "NEXT_PUBLIC_SITE_URL") expect(match?.[1]).toBe("");
        }
    });
});

describe("manifest hygiene", () => {
    it("has no duplicate keys", () => {
        const keys = ENV_MANIFEST.map((s) => s.key);
        expect(keys).toHaveLength(new Set(keys).size);
    });

    it("gives every key a description", () => {
        for (const spec of ENV_MANIFEST) expect(spec.description.length).toBeGreaterThan(10);
    });

    it("covers every checkEnv call site in the codebase", () => {
        // A checkEnv("X") that isn't in the manifest is a variable the boot check silently ignores —
        // exactly the gap this whole change is closing.
        const sources = ["lib", "actions", "app", "i18n", "proxy.ts", "prisma.config.ts", "instrumentation.ts"];
        const seen = new Set<string>();

        const walk = (path: string) => {
            const stat = statSync(path, { throwIfNoEntry: false });
            if (!stat) return;
            if (stat.isDirectory()) {
                for (const entry of readdirSync(path)) walk(`${path}/${entry}`);
                return;
            }
            if (!/\.tsx?$/.test(path) || path.endsWith(".test.ts")) return;
            for (const m of readFileSync(path, "utf8").matchAll(/checkEnv\(\s*"([A-Z0-9_]+)"/g)) seen.add(m[1]);
        };
        sources.forEach(walk);

        const declared = new Set(ENV_MANIFEST.map((s) => s.key));
        expect(seen.size).toBeGreaterThan(5);
        expect([...seen].filter((k) => !declared.has(k)).sort()).toEqual([]);
    });
});
