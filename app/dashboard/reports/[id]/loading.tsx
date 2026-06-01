import { PageScaffold } from "@/components/scaffolds/page-scaffold";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportWrapper } from "@/components/wrappers/report-wrapper";

export default function DashboardReportLoadingPage() {
    return (
        <PageScaffold
            title={<Skeleton className="h-8 w-46" />}
            description="This report analyzes your data from a series of daily snapshots."
        >
            <ReportWrapper loading />
        </PageScaffold>
    );
}
