"use client";

import { Sidebar, SidebarContent, SidebarFooter } from "../ui/sidebar";
import type { WithClientProps } from "./config";
import { DashboardSidebarHeader } from "./header";
import { DashboardSidebarPages } from "./pages";
import { DashboardSidebarUser } from "./user";

export function DashboardSidebar({ client }: WithClientProps) {
    return (
        <Sidebar variant="inset" collapsible="icon" className="overscroll-none *:**:overscroll-none">
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
