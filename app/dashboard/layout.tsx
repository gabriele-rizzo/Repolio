import { authorize } from "@/actions/auth/authorize";
import { DashboardSidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: React.PropsWithChildren) {
    const client = await authorize();
    if (!client) redirect("/auth/login");

    return (
        <SidebarProvider>
            <DashboardSidebar client={client} />

            <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
    );
}
