import { checkEnv } from "@/lib/env";

const DEFAULT_BASE = "https://zernio.com/api";

export class ZernioError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = "ZernioError";
    }
}

// Raised on 401/403 — an API-key/auth problem, distinct from a per-resource 4xx. Lets callers
// tell "Zernio is misconfigured" apart from "this one account failed", so the daily cron doesn't
// mistake a bad key for every client being disconnected.
export class ZernioAuthError extends ZernioError {}

type QueryValue = string | number | boolean | null | undefined;

interface ZernioRequest {
    method?: string;
    query?: Record<string, QueryValue>;
    body?: unknown;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const base = (process.env.ZERNIO_API_BASE ?? DEFAULT_BASE).replace(/\/+$/, "");
    const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
}

/**
 * Single entry point for Zernio REST calls. `checkEnv` runs HERE (per request), never at module
 * load — so a missing ZERNIO_API_KEY can't crash importers (notably the snapshot cron) at import
 * time; it fails the individual call instead. Returns the parsed JSON body (undefined for 204).
 */
export async function zernioFetch<T>(path: string, { method = "GET", query, body }: ZernioRequest = {}): Promise<T> {
    const key = checkEnv("ZERNIO_API_KEY");

    const res = await fetch(buildUrl(path, query), {
        method,
        headers: {
            Authorization: `Bearer ${key}`,
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        // We drive freshness ourselves (daily snapshots); never let Next cache Zernio responses.
        cache: "no-store",
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const message = `[Zernio] ${method} ${path} failed (${res.status})${detail ? `: ${detail}` : ""}`;
        if (res.status === 401 || res.status === 403) throw new ZernioAuthError(message, res.status);
        throw new ZernioError(message, res.status);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}
