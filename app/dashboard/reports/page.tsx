import { ReportsWrapper } from "@/components/wrappers/reports-wrapper";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Reports | Repolio",
};

export default function DashboardReportsPage() {
    return <ReportsWrapper />;
}
