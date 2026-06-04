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
