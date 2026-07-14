import type { Platform } from "@/generated/prisma/browser";
import { prisma } from "@/lib/prisma";
import { listAccounts } from "./accounts";
import { listAdAccounts } from "./ads";
import { ZernioError } from "./client";
import { connectAds } from "./connect";
import type { ZernioPlatform } from "./platform-map";
import type { ZernioAdAccount } from "./types";

// Zernio platform values that count as a Meta posting account (same-token source for ads).
const META_POSTING_PLATFORMS = ["facebook", "instagram"];

// Zernio's ad-account listing lags the grant right after connect. Poll a few times before giving
// up so a connect finished seconds after the grant exists still captures the ad accounts. The
// connection is recorded regardless (see below) — this only affects whether ad accounts are
// captured on this pass or backfilled later.
const AD_ACCOUNT_RETRY_DELAYS_MS = [0, 800, 1600];

export type FinishResult =
    | { ok: true; hadAdAccounts: boolean }
    // no_posting: the grant is partial/stale (no usable posting account to build the ads grant from);
    // the caller may free it and force a fresh OAuth. plan_limit / error: surface, do not destroy.
    | { ok: false; reason: "no_posting" | "plan_limit" | "error" };

async function listAdAccountsWithRetry(accountId: string) {
    let accounts: ZernioAdAccount[] = [];
    for (const delay of AD_ACCOUNT_RETRY_DELAYS_MS) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        accounts = await listAdAccounts(accountId);
        if (accounts.length > 0) break;
    }
    return accounts;
}

/**
 * Upserts Zernio ad accounts under a connection. No-op for an empty list.
 *
 * Deliberately NOT wrapped in a single `$transaction`: batching many upserts against a remote DB
 * blows Prisma's 5s interactive-transaction cap (P2028) for connections with lots of ad accounts.
 * The upserts are independent and idempotent, so we run them one at a time with no transaction —
 * partial progress on a mid-list failure is fine (the rest backfill on the next snapshot run).
 */
export async function upsertAdAccounts(connectionId: number, accounts: ZernioAdAccount[]): Promise<void> {
    for (const acc of accounts) {
        await prisma.adAccount.upsert({
            where: { connection_id_external_id: { connection_id: connectionId, external_id: acc.id } },
            create: {
                connection_id: connectionId,
                external_id: acc.id,
                name: acc.name ?? null,
                currency: acc.currency ?? null,
                timezone: acc.timezoneName ?? null,
            },
            update: {
                name: acc.name ?? null,
                currency: acc.currency ?? null,
                timezone: acc.timezoneName ?? null,
            },
        });
    }
}

/**
 * Records a Zernio grant as a PlatformConnection (+ its ad accounts) for a client. Shared by the
 * OAuth callback and the connect route's reconcile path.
 *
 * The connection row is written as soon as the ads grant resolves — even when Zernio lists zero ad
 * accounts. This is the fix for the Zernio/Repolio desync: previously we bailed before the write
 * when no ad accounts came back (usually just sync lag), leaving a live grant that Repolio had no
 * record of and that the UI therefore showed as "not connected". Any lagging ad accounts are
 * backfilled on the next snapshot run (see collectSnapshots) or on a reconnect.
 */
export async function finishConnection(
    clientId: number,
    config: ZernioPlatform,
    platform: Platform,
    profileId: string,
    accountIdParam: string | null,
): Promise<FinishResult> {
    try {
        let adsAccountId: string;
        let postingAccountId: string | null = null;

        if (config.kind === "same-token") {
            // Meta: find the posting account, then copy its token into an ads grant.
            const accounts = await listAccounts(profileId);
            const posting =
                (accountIdParam && accounts.find((a) => a._id === accountIdParam)) ||
                accounts.find((a) => a.platform === config.connectedParam) ||
                accounts.find((a) => META_POSTING_PLATFORMS.includes(a.platform));

            if (!posting) {
                console.error(
                    `finishConnection: no posting account in profile ${profileId} (${accounts.length} accounts: ${accounts
                        .map((a) => a.platform)
                        .join(", ")})`,
                );
                return { ok: false, reason: "no_posting" };
            }

            postingAccountId = posting._id;
            adsAccountId = await connectAds(config, profileId, posting._id);
        } else {
            // Standalone (googleads, unused today): prefer the redirect's accountId, else find the
            // ads account by its connected platform.
            if (accountIdParam) {
                adsAccountId = accountIdParam;
            } else {
                const adsPlatform = config.adsPlatform ?? config.adsSlug;
                const accounts = await listAccounts(profileId);
                const ads = accounts.find((a) => a.platform === adsPlatform);
                if (!ads) {
                    console.error(`finishConnection: no ${adsPlatform} account in profile ${profileId}`);
                    return { ok: false, reason: "no_posting" };
                }
                adsAccountId = ads._id;
            }
        }

        const adAccounts = await listAdAccountsWithRetry(adsAccountId);

        const connection = await prisma.platformConnection.upsert({
            where: { client_id_platform: { client_id: clientId, platform } },
            create: {
                client_id: clientId,
                platform,
                zernio_account_id: adsAccountId,
                zernio_posting_account_id: postingAccountId,
                status: "CONNECTED",
            },
            update: {
                zernio_account_id: adsAccountId,
                zernio_posting_account_id: postingAccountId,
                status: "CONNECTED",
            },
        });

        await upsertAdAccounts(connection.id, adAccounts);

        return { ok: true, hadAdAccounts: adAccounts.length > 0 };
    } catch (error) {
        console.error(`finishConnection failed for client ${clientId} (${platform}):`, error);
        // 402/403 from connectAds means the workspace plan lacks ads access (Ads add-on).
        if (error instanceof ZernioError && (error.status === 402 || error.status === 403)) {
            return { ok: false, reason: "plan_limit" };
        }
        return { ok: false, reason: "error" };
    }
}
