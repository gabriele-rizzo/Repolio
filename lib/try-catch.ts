import type { NextResponse } from "next/server";

declare global {
    type Success<T> = { data: T; error: null };
    type Failure<E> = { data: null; error: E };
    type Result<T, E> = Success<T> | Failure<E>;

    type ResultResponse<T, E> = NextResponse<Result<T, E>>;
}

export const err = <E>(error: E): Failure<E> => ({ data: null, error });
export const ok = <T>(data: T): Success<T> => ({ data, error: null });

export function sink<T, E>(results: Result<T, E>[]): [T[], E[]] {
    const successes: T[] = [];
    const failures: E[] = [];

    for (const r of results) {
        if (r.error) failures.push(r.error);
        else successes.push(r.data as T);
    }

    return [successes, failures];
}

export function settle<T, E>(name: string, data: Result<T, E>[]): Result<T[], string> {
    const [successes, failures] = sink(data);

    if (failures.length > 0) {
        failures.forEach((e) => console.error(`There was an error during '${name}': ${e}`));

        if (successes.length === 0) {
            return err(`No successful outcome from '${name}' and there were errors (check logs).`);
        }
    }

    return ok(successes);
}

/**
 * Runs one query and hands back a Result instead of throwing.
 *
 * For surfaces that must render even when a table is missing. Migrations here are applied by hand
 * against production, so code routinely deploys before its migration lands — and the pages that would
 * break are the admin ones you open precisely to find out what is wrong. Same contract as the writers
 * in lib/sync-error.ts and lib/cron/run-record.ts: degrade to a note, never a 500.
 */
export async function attempt<T>(query: Promise<T>): Promise<Result<T, string>> {
    try {
        return ok(await query);
    } catch (error) {
        return err(String(error));
    }
}

/**
 * Narrow on `data`, not on `error`.
 *
 * `error: string` includes `""`, which is falsy, so `if (result.error)` does not discriminate this
 * union for the type checker — the falsy branch could still be the failure member. Testing
 * `data === null` does.
 */
export const failed = <T,>(r: Result<T, string>): r is Failure<string> => r.data === null;
