import { getCurrentClient } from "@/actions/auth/authorize";
import { renderReportEmail } from "@/lib/email/render-report";
import { NextResponse } from "next/server";

// Returns the standalone HTML render of a report (the same output used for emailing). Consumed by the
// report's Download button, which prints it to PDF client-side. Node runtime: renderReportEmail uses
// react-dom/server. Scoped to the signed-in client via renderReportEmail's ownership check.
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const client = await getCurrentClient();
    if (!client) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const reportId = Number(id);
    if (!Number.isInteger(reportId)) return new NextResponse("Invalid report id", { status: 400 });

    const rendered = await renderReportEmail(reportId, client.id);
    if (!rendered) return new NextResponse("Report not found", { status: 404 });

    return new NextResponse(rendered.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
