// Generic bounded retry with exponential backoff and full jitter. Deliberately dependency-free so
// it can be exercised standalone (e.g. `pnpm dlx tsx`) without the app's env/prisma bootstrapping.

export interface RetryOptions {
    /** Total attempts including the first. */
    attempts?: number;
    baseDelayMs?: number;
    /** Cap on any single wait, server-suggested delays included. */
    maxDelayMs?: number;
    shouldRetry: (error: unknown) => boolean;
    /** Server-suggested wait (e.g. parsed Retry-After) — floors the backoff for that attempt. */
    retryAfterMs?: (error: unknown) => number | null | undefined;
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
    const { attempts = 3, baseDelayMs = 500, maxDelayMs = 8_000, shouldRetry, retryAfterMs, onRetry } = options;

    for (let attempt = 1; ; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt >= attempts || !shouldRetry(error)) throw error;

            // Full jitter decorrelates the cron's wide fan-out so retries don't re-stampede the API.
            const backoff = baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random() * 0.5);
            const delay = Math.round(Math.min(maxDelayMs, Math.max(retryAfterMs?.(error) ?? 0, backoff)));
            onRetry?.(error, attempt, delay);
            await sleep(delay);
        }
    }
}
