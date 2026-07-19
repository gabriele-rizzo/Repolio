import { authorize } from "@/actions/auth/authorize";
import { ConnectButtons } from "@/components/account/connect-buttons";
import { ConnectionStatusToast } from "@/components/account/connection-status-toast";
import { HomeOverview } from "@/components/dashboard/home-overview";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Home | Repolio",
};

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ meta_connected?: string; meta_error?: string }>;
}) {
    const client = await authorize();

    const { meta_connected, meta_error } = await searchParams;

    return (
        <>
            <ConnectionStatusToast connected={meta_connected === "1"} error={meta_error} />

            <HomeOverview
                clientId={client.id}
                reportHref={(id) => `/dashboard/reports?account=${id}`}
                emptyAction={<ConnectButtons />}
            />
        </>
    );
}
