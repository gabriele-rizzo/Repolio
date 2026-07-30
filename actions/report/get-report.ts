"use server";

import type { Client } from "@/generated/prisma/browser";
import { fetchReport } from "@/lib/report/fetch-report";

export type { FetchedReport } from "@/lib/report/fetch-report";

/**
 * The client-facing report read: scoped to `client_id` and to reports an admin has released. Both
 * options are pinned here on purpose — this module is a "use server" boundary, so anything it accepts
 * as an argument is reachable from the browser.
 *
 * Admin-gated server code that needs to read an unreleased report (the validation screen) calls
 * `fetchReport` directly instead.
 */
export async function getReport(id: string, client_id: Client["id"]) {
    return fetchReport(id, { clientId: client_id });
}
