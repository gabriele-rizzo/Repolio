import type { NextRequest } from "next/server";

export function getParam<T>(label: string, request: NextRequest, map: (value: string) => T): T | undefined {
    const params = request.nextUrl.searchParams;
    const value = params.get(label);

    if (!value) return;
    return map(value);
}
