import { authorize } from "@/actions/auth/authorize";
import { metaListAdAccounts, type MetaAdAccount } from "@/actions/meta/list-ad-accounts";
import { checkEnv } from "@/lib/env";
import { encryptToken } from "@/lib/meta/crypto";
import { exchangeCodeForToken, exchangeForLongLivedToken, getMetaUserId } from "@/lib/meta/oauth";
import { META_STATE_COOKIE } from "@/lib/meta/state";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

function siteUrl(path: string) {
    return new URL(path, checkEnv("NEXT_PUBLIC_SITE_URL"));
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const metaError = searchParams.get("error");
    if (metaError) {
        const description = searchParams.get("error_description") ?? metaError;
        return NextResponse.redirect(siteUrl(`/dashboard?meta_error=${encodeURIComponent(description)}`));
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    const store = await cookies();
    const expectedState = store.get(META_STATE_COOKIE)?.value;

    store.delete(META_STATE_COOKIE);

    if (!code || !state || !expectedState || state !== expectedState) {
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=invalid_state"));
    }

    const client = await authorize();
    if (!client) return NextResponse.redirect(siteUrl("/auth/login"));

    let access_token: string;
    let expires_at: Date | undefined;
    let external_user_id: string;
    let accounts: MetaAdAccount[];

    try {
        const short = await exchangeCodeForToken(code);
        const long = await exchangeForLongLivedToken(short.access_token);

        access_token = encryptToken(long.access_token);
        expires_at = long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : undefined;
        external_user_id = await getMetaUserId(long.access_token);
        accounts = await metaListAdAccounts(long.access_token);
    } catch (error) {
        console.error("Meta OAuth exchange failed:", error);
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=connection_failed"));
    }

    if (accounts.length === 0) {
        return NextResponse.redirect(siteUrl("/dashboard?meta_error=no_ad_accounts"));
    }

    const connection = await prisma.platformConnection.upsert({
        where: { client_id_platform: { client_id: client.id, platform: "META" } },
        create: {
            client_id: client.id,
            platform: "META",
            access_token,
            expires_at,
            external_user_id,
        },
        update: {
            access_token,
            expires_at,
            external_user_id,
        },
    });

    await prisma.$transaction(
        accounts.map((account) =>
            prisma.adAccount.upsert({
                where: {
                    connection_id_external_id: { connection_id: connection.id, external_id: account.account_id },
                },
                create: { connection_id: connection.id, external_id: account.account_id, name: account.name ?? null },
                update: { name: account.name ?? null },
            }),
        ),
    );

    return NextResponse.redirect(siteUrl("/dashboard?meta_connected=1"));
}
