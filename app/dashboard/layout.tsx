import { authorize } from "@/actions/auth/authorize";
import { DashboardSidebar } from "@/components/sidebar";
import { SIDEBAR_STATE_COOKIE } from "@/components/sidebar/config";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
    title: "Dasboard | Repolio",
};

export default async function DashboardLayout({ children }: React.PropsWithChildren) {
    const client = await authorize();
    const store = await cookies();

    const open = store.get(SIDEBAR_STATE_COOKIE)?.value === "true";

    return (
        <SidebarProvider defaultOpen={open}>
            <DashboardSidebar client={client} />

            <SidebarInset className="overflow-hidden relative">
                <div className="overflow-auto size-full overscroll-none">{children}</div>
            </SidebarInset>
        </SidebarProvider>
    );
}
