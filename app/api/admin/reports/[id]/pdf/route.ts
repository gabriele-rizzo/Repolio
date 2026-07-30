import { isAdminAuthenticated } from "@/lib/admin/auth";
import { renderReportPdf } from "@/lib/email/render-report-pdf";
import { NextResponse } from "next/server";

// Serves the exact PDF that a report will be attached as when its batch is validated, so an admin can
// read the real artifact before approving it. Admin-gated and deliberately not scoped to a client:
// the whole point is to review reports the client cannot see yet.
//
// Node runtime: react-pdf renders to a Buffer.
export const runtime = "nodejs";

// Rendering a PDF is CPU-bound; keep it off the 10s default budget.
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAdminAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const reportId = Number(id);
    if (!Number.isInteger(reportId)) return new NextResponse("Invalid report id", { status: 400 });

    const rendered = await renderReportPdf(reportId);
    if (!rendered) return new NextResponse("Report not found, or it has no snapshots to report on", { status: 404 });

    return new NextResponse(new Uint8Array(rendered.content), {
        headers: {
            "content-type": "application/pdf",
            // inline: opens in the browser's PDF viewer, which is what review wants.
            "content-disposition": `inline; filename="${rendered.filename}"`,
            "cache-control": "no-store",
        },
    });
}
