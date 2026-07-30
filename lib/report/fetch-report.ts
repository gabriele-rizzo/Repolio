import { prisma } from "@/lib/prisma";
import { RELEASED_REPORT } from "@/lib/report/visibility";

export type FetchedReport = NonNullable<Awaited<ReturnType<typeof fetchReport>>>;

export interface FetchReportOptions {
    /** Restrict to reports owned by this client. Omit only from admin-gated server code. */
    clientId?: number;
    /**
     * Include reports that haven't been released to the client yet. Admin-only — the validation
     * screen has to render exactly the report it's about to approve. Defaults to false.
     */
    allowUnreleased?: boolean;
}

/**
 * Loads one report plus the account it belongs to and the period it covered, so a page can compute
 * KPIs live for that window. A report itself carries only the AI output.
 *
 * A trusted server helper, deliberately NOT a server action: `allowUnreleased` would otherwise be a
 * client-callable switch for bypassing report validation. The client-facing entry point is
 * `actions/report/get-report.ts`, which pins both options.
 */
export async function fetchReport(id: string, { clientId, allowUnreleased = false }: FetchReportOptions = {}) {
    if (isNaN(+id)) return null;

    const report = await prisma.report.findFirst({
        where: {
            id: parseInt(id),
            ...(clientId == null ? {} : { snapshots: { some: { ad_account: { connection: { client_id: clientId } } } } }),
            ...(allowUnreleased ? {} : RELEASED_REPORT),
        },
        include: {
            snapshots: {
                orderBy: { start_date: "asc" },
                select: { start_date: true, ad_account_id: true, platform: true },
            },
        },
    });

    if (!report) return null;

    const first = report.snapshots[0];
    const from = first?.start_date ?? report.created_at;
    // End on the last day the report actually covers (reports connect complete days only), not the
    // creation instant — otherwise the default window bleeds into the partial day after the period.
    const to = report.snapshots.at(-1)?.start_date ?? report.created_at;

    const account = first
        ? await prisma.adAccount.findUnique({
              where: { id: first.ad_account_id },
              select: { id: true, name: true, context_note: true, connection: { select: { platform: true } } },
          })
        : null;

    return { report, account, from, to };
}
