import { prisma } from "@/lib/prisma";
import { DEFAULT_TEMPLATE_BODY } from "@/lib/report/template/presets";

export interface ResolvedTemplate {
    body: string;
    /** Where the body came from, so the editor can say "this account uses the client default". */
    source: "account" | "client" | "builtin";
}

/**
 * The template that governs one ad account's reports: its own override, else the owning client's
 * default, else the built-in preset.
 *
 * Two rows at most are consulted, in one query each, and a missing row is not an error — the built-in
 * fallback is what makes this safe to call from the delivery path for a client who has never opened the
 * template editor.
 */
export async function resolveTemplate(adAccountId: number | null, clientId: number): Promise<ResolvedTemplate> {
    if (adAccountId != null) {
        const override = await prisma.reportTemplate.findUnique({
            where: { ad_account_id: adAccountId },
            select: { body: true },
        });
        if (override?.body.trim()) return { body: override.body, source: "account" };
    }

    const clientDefault = await prisma.reportTemplate.findUnique({
        where: { client_id: clientId },
        select: { body: true },
    });
    if (clientDefault?.body.trim()) return { body: clientDefault.body, source: "client" };

    return { body: DEFAULT_TEMPLATE_BODY, source: "builtin" };
}
