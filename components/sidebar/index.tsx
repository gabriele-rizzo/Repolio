import { Sidebar, SidebarContent, SidebarFooter } from "../ui/sidebar";
import type { WithClientProps } from "./config";
import { DashboardSidebarHeader } from "./header";
import { DashboardSidebarPages } from "./pages";
import { DashboardSidebarUser } from "./user";

export function DashboardSidebar({ client }: WithClientProps) {
    return (
        <Sidebar variant="inset">
            <DashboardSidebarHeader />

            <SidebarContent>
                <DashboardSidebarPages />
            </SidebarContent>

            <SidebarFooter>
                <DashboardSidebarUser client={client} />
            </SidebarFooter>
        </Sidebar>
    );
}
