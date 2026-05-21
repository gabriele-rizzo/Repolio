import { checkEnv } from "../env";

interface MetaApiResponse<T extends object> {
    data: T[];
}

export async function metaApi<T extends object>(
    path: string,
    access_token: string,
    fields: string[],
): Promise<MetaApiResponse<T>> {
    const version = checkEnv("META_GRAPH_API_VERSION");

    const base = { access_token, limit: "100" };
    const params = new URLSearchParams(fields.length === 0 ? base : { ...base, fields: fields.join(",") });

    const slashed = path.startsWith("/") ? path : `/${path}`;
    const res = await fetch(`https://graph.facebook.com/${version}${slashed}?${params}`);

    if (!res.ok) throw new Error(`[META API] ${slashed} failed (${res.status}): ${await res.text()}`);
    return await res.json();
}
