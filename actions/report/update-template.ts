"use server";

import { authorize } from "@/actions/auth/authorize";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { checkTemplate } from "@/lib/report/template/render";
import { renderTemplatePreview } from "@/lib/report/template/preview";
import { MAX_TEMPLATE_LENGTH, type TemplateIssue } from "@/lib/report/template/types";
import { revalidatePath } from "next/cache";

/**
 * Confirms an ad account belongs to the signed-in client, since the scope of every action here is
 * either the client themselves or one of their accounts.
 */
async function assertOwnedAccount(clientId: number, adAccountId: number): Promise<void> {
    const account = await prisma.adAccount.findFirst({
        where: { id: adAccountId, connection: { client_id: clientId } },
        select: { id: true },
    });
    if (!account) throw new Error("Ad account not found.");
}

/**
 * Saves a report template: the client's default when `adAccountId` is null, otherwise an override for
 * that one account.
 *
 * Returns any parse issues alongside success. A template with unknown placeholders is deliberately
 * still SAVED — the issues are advisory, the renderer degrades gracefully, and refusing to save
 * half-finished work is worse than showing a warning.
 */
export async function saveReportTemplate(
    body: string,
    adAccountId: number | null,
): Promise<{ issues: TemplateIssue[] }> {
    if (body.length > MAX_TEMPLATE_LENGTH) {
        throw new Error(`Templates must be ${MAX_TEMPLATE_LENGTH.toLocaleString("en-US")} characters or fewer.`);
    }
    if (body.trim().length === 0) throw new Error("The template can't be empty. Use Reset to go back to the default.");

    const client = await authorize();
    if (adAccountId != null) await assertOwnedAccount(client.id, adAccountId);

    const where = adAccountId == null ? { client_id: client.id } : { ad_account_id: adAccountId };
    const create = adAccountId == null ? { client_id: client.id, body } : { ad_account_id: adAccountId, body };

    await prisma.reportTemplate.upsert({ where, create, update: { body } });

    revalidatePath("/dashboard/template");

    return { issues: checkTemplate(body) };
}

/**
 * Removes a stored template, so the scope falls back through the chain again: an account override falls
 * back to the client's default, and the client's default falls back to the built-in preset.
 */
export async function resetReportTemplate(adAccountId: number | null): Promise<void> {
    const client = await authorize();
    if (adAccountId != null) await assertOwnedAccount(client.id, adAccountId);

    // Typed explicitly: a ternary of two different key shapes narrows to the first branch's type.
    const where: Prisma.ReportTemplateWhereInput =
        adAccountId == null ? { client_id: client.id } : { ad_account_id: adAccountId };
    await prisma.reportTemplate.deleteMany({ where });

    revalidatePath("/dashboard/template");
}

/** Renders the given (unsaved) template body against real data, for the editor's preview pane. */
export async function previewReportTemplate(
    body: string,
    adAccountId: number | null,
): Promise<{ html: string; basis: "report" | "sample" }> {
    const client = await authorize();
    if (adAccountId != null) await assertOwnedAccount(client.id, adAccountId);

    return renderTemplatePreview({ clientId: client.id, adAccountId, body });
}
