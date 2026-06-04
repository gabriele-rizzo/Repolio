"use server";

import { type Client, type PlatformConnection, type Snapshot } from "@/generated/prisma/browser";
import { renderConnectionExpiredEmail } from "@/lib/email/render-connection-expired";
import { DAY_MS, REFRESH_THRESHOLD_DAYS } from "@/lib/meta/expiry";
import { refreshConnectionIfNeeded } from "@/lib/meta/refresh";
import { PLATFORM_META } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { err, ok, sink } from "@/lib/try-catch";
import { fetchSnapshot } from "./fetch-snapshot";

export async function collectSnapshots(client: Client): Promise<Result<Snapshot[], string>> {
    const adAccounts = await prisma.adAccount.findMany({
        where: { active: true, connection: { client_id: client.id } },
        include: { connection: true },
    });

    // Refresh tokens nearing expiry. Many ad accounts can share one connection, so dedupe by
    // connection id and refresh each at most once. A failed refresh (e.g. the token is already
    // dead) doesn't abort collection — it pauses that connection below and notifies the client.
    const connections = new Map(adAccounts.map((a) => [a.connection.id, a.connection]));
    let refreshed = false;
    await Promise.all(
        [...connections.values()].map(async (connection) => {
            try {
                // refreshConnectionIfNeeded returns the same object when it no-ops, a new one when it updates.
                const updated = await refreshConnectionIfNeeded(connection);
                if (updated !== connection) refreshed = true;
            } catch (error) {
                console.error(`Token refresh failed for connection ${connection.id}:`, error);
                // Never let notification delivery fail the snapshot run.
                try {
                    await notifyConnectionExpired(client, connection);
                } catch (notifyError) {
                    console.error(`Failed to notify client ${client.id} of expired connection:`, notifyError);
                }
            }
        }),
    );

    // Only re-read when a refresh actually changed something, so the expiry filter (and the
    // real-API token use) see current values. Most runs refresh nothing and reuse the loaded rows.
    const accounts = refreshed
        ? await prisma.adAccount.findMany({
              where: { active: true, connection: { client_id: client.id } },
              include: { connection: true },
          })
        : adAccounts;

    const now = new Date();
    const usable = accounts.filter((a) => (a.connection.expires_at ? new Date(a.connection.expires_at) > now : true));
    const results = await Promise.all(usable.map((a) => fetchSnapshot(a)));
    const [data, errors] = sink(results);

    if (errors.length > 0) {
        errors.forEach((e) => console.error(`Snapshot fetch failed: ${e}`));

        if (data.length === 0) {
            return err(`No successful snapshot fetch for client '${client.id}', but there were errors (check logs).`);
        }
    }

    try {
        const snapshots = await prisma.snapshot.createManyAndReturn({ data, skipDuplicates: true });
        return ok(snapshots);
    } catch {
        return err(`Failed to insert snapshots for client '${client.id}'`);
    }
}

/**
 * In-app + email notice that a connection's token couldn't be refreshed and the client needs to
 * reconnect. Rate-limited to once per REFRESH_THRESHOLD_DAYS per client so a persistently-dead
 * connection doesn't email them every day. (A client holds at most one connection per platform
 * today, so this is effectively per-connection; revisit the dedupe key if that changes.) Delivery
 * failures are logged, never thrown — they must not fail snapshot collection.
 */
async function notifyConnectionExpired(client: Client, connection: PlatformConnection): Promise<void> {
    const since = new Date(Date.now() - REFRESH_THRESHOLD_DAYS * DAY_MS);
    const recent = await prisma.notification.findFirst({
        where: { client_id: client.id, type: "CONNECTION_EXPIRED", created_at: { gte: since } },
        select: { id: true },
    });
    if (recent) return;

    const platformLabel = PLATFORM_META[connection.platform].label;
    const link = "/dashboard/account";

    try {
        await prisma.notification.create({
            data: {
                client_id: client.id,
                type: "CONNECTION_EXPIRED",
                title: `Reconnect your ${platformLabel} account`,
                body: `We couldn't refresh your ${platformLabel} connection, so new report data has paused. Reconnect to resume.`,
                link,
            },
        });
    } catch (error) {
        console.error(`Failed to create CONNECTION_EXPIRED notification for client ${client.id}:`, error);
    }

    try {
        const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
        const reconnectUrl = base ? `${base}${link}` : link;
        const email = renderConnectionExpiredEmail({ clientName: client.name, platformLabel, reconnectUrl });

        // Lazy import so a missing/invalid RESEND_API_KEY can't crash snapshot collection.
        const { resend } = await import("@/lib/resend");
        const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM ?? "Repolio <team@gj-automate.com>",
            to: client.email,
            subject: email.subject,
            html: email.html,
        });
        if (error) console.error(`Resend rejected connection-expired email for client ${client.id}:`, error);
    } catch (error) {
        console.error(`Failed to send connection-expired email for client ${client.id}:`, error);
    }
}
