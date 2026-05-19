import { authorize } from "@/actions/auth/authorize";
import { DashboardSidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: React.PropsWithChildren) {
    const user = await authorize();
    if (!user) redirect("/auth/login");

    return (
        <SidebarProvider>
            <DashboardSidebar client={user} />

            <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
    );
}
