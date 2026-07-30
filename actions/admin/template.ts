"use server";

import { isAdminAuthenticated } from "@/lib/admin/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseTemplate } from "@/lib/report/template/parse";
import { findPreset } from "@/lib/report/template/presets";
import { renderTemplatePreview } from "@/lib/report/template/preview";
import { MAX_TEMPLATE_LENGTH, type TemplateIssue } from "@/lib/report/template/types";
import { revalidatePath } from "next/cache";

/**
 * Admin-side report template management: set a client's default layout, or an override on one of their
 * ad accounts.
 *
 * Clients can edit the same templates from their own page, so whoever saves last wins — this is not a
 * lock. Every function gates on the admin session independently of the layout UI, since server actions
 * are public endpoints.
 */

async function assertAdmin(): Promise<void> {
    if (!(await isAdminAuthenticated())) throw new Error("Unauthorized.");
}

/** Confirms the scope exists and, for an account, that it really belongs to `clientId`. */
async function assertScope(clientId: number, adAccountId: number | null): Promise<void> {
    if (adAccountId == null) {
        const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
        if (!client) throw new Error("That client no longer exists.");
        return;
    }

    const account = await prisma.adAccount.findFirst({
        where: { id: adAccountId, connection: { client_id: clientId } },
        select: { id: true },
    });
    if (!account) throw new Error("That ad account doesn't belong to this client.");
}

export async function setClientTemplate(
    clientId: number,
    body: string,
    adAccountId: number | null,
): Promise<{ issues: TemplateIssue[] }> {
    await assertAdmin();

    if (body.length > MAX_TEMPLATE_LENGTH) {
        throw new Error(`Templates must be ${MAX_TEMPLATE_LENGTH.toLocaleString("en-US")} characters or fewer.`);
    }
    if (body.trim().length === 0) throw new Error("The template can't be empty. Use Reset to clear it instead.");

    await assertScope(clientId, adAccountId);

    const where = adAccountId == null ? { client_id: clientId } : { ad_account_id: adAccountId };
    const create = adAccountId == null ? { client_id: clientId, body } : { ad_account_id: adAccountId, body };

    await prisma.reportTemplate.upsert({ where, create, update: { body } });

    revalidatePath("/admin/templates");
    revalidatePath("/dashboard/template");

    return { issues: parseTemplate(body).issues };
}

/** Clears a stored template so the scope inherits again (account -> client -> built-in preset). */
export async function resetClientTemplate(clientId: number, adAccountId: number | null): Promise<void> {
    await assertAdmin();
    await assertScope(clientId, adAccountId);

    // Typed explicitly: a ternary of two different key shapes narrows to the first branch's type.
    const where: Prisma.ReportTemplateWhereInput =
        adAccountId == null ? { client_id: clientId } : { ad_account_id: adAccountId };
    await prisma.reportTemplate.deleteMany({ where });

    revalidatePath("/admin/templates");
    revalidatePath("/dashboard/template");
}

/**
 * Applies a built-in preset to a scope in one step, for setting a client up without opening the editor.
 *
 * COPIES the preset body rather than linking to it, so later edits to the preset in code never silently
 * rewrite what an existing client already receives.
 */
export async function applyPresetToClient(
    clientId: number,
    presetId: string,
    adAccountId: number | null,
): Promise<void> {
    await assertAdmin();

    const preset = findPreset(presetId);
    if (!preset) throw new Error("Unknown preset.");

    await setClientTemplate(clientId, preset.body, adAccountId);
}

/** Renders a template body against the client's real data, including reports not yet released. */
export async function previewClientTemplate(
    clientId: number,
    body: string,
    adAccountId: number | null,
): Promise<{ html: string; basis: "report" | "sample" }> {
    await assertAdmin();
    await assertScope(clientId, adAccountId);

    // Admins preview against unreleased reports on purpose — the point is to set a layout up before the
    // client's first batch is validated.
    return renderTemplatePreview({ clientId, adAccountId, body, allowUnreleased: true });
}
