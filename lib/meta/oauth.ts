import { checkEnv } from "@/lib/env";

export type TokenResponse = {
    access_token: string;
    token_type: string;
    expires_in?: number;
};

function graphUrl(path: string) {
    const version = checkEnv("META_GRAPH_API_VERSION");
    return `https://graph.facebook.com/${version}${path}`;
}

export function getRedirectUri() {
    const siteUrl = checkEnv("NEXT_PUBLIC_SITE_URL");
    return `${siteUrl}/api/meta/callback`;
}

export function buildAuthorizeUrl(state: string) {
    const version = checkEnv("META_GRAPH_API_VERSION");
    const params = new URLSearchParams({
        client_id: checkEnv("META_APP_ID"),
        config_id: checkEnv("META_LOGIN_CONFIG_ID"),
        redirect_uri: getRedirectUri(),
        state,
        response_type: "code",
    });

    return `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
        client_id: checkEnv("META_APP_ID"),
        client_secret: checkEnv("META_APP_SECRET"),
        redirect_uri: getRedirectUri(),
        code,
    });

    const res = await fetch(`${graphUrl("/oauth/access_token")}?${params.toString()}`);
    if (!res.ok) throw new Error(`Meta code exchange failed (${res.status}): ${await res.text()}`);

    return res.json();
}

export async function getMetaUserId(accessToken: string): Promise<string> {
    const params = new URLSearchParams({ access_token: accessToken, fields: "id" });
    const res = await fetch(`${graphUrl("/me")}?${params.toString()}`);

    if (!res.ok) throw new Error(`Meta /me lookup failed (${res.status}): ${await res.text()}`);

    const data = (await res.json()) as { id: string };
    return data.id;
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: checkEnv("META_APP_ID"),
        client_secret: checkEnv("META_APP_SECRET"),
        fb_exchange_token: shortLivedToken,
    });

    const res = await fetch(`${graphUrl("/oauth/access_token")}?${params.toString()}`);
    if (!res.ok) throw new Error(`Meta long-lived exchange failed (${res.status}): ${await res.text()}`);

    return res.json();
}
