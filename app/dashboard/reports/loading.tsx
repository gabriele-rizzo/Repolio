import { ReportLoading } from "@/components/report/report-loading";

// `/dashboard/reports?account=<id>` only resolves the account's latest report and redirects, so this
// boundary is the first thing an account click shows. It draws the destination's skeleton, not one of
// its own — the redirect then swaps in /dashboard/reports/[id]'s identical fallback without a reflow.
export default function DashboardReportsLoadingPage() {
    return <ReportLoading />;
}
