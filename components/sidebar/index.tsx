"use client";

import { Sidebar, SidebarContent, SidebarFooter } from "../ui/sidebar";
import type { WithClientProps } from "./config";
import { DashboardSidebarControl } from "./control";
import { DashboardSidebarHeader } from "./header";
import { DashboardSidebarPages } from "./pages";
import { DashboardSidebarUser } from "./user";

export function DashboardSidebar({ client }: WithClientProps) {
    return (
        <Sidebar variant="inset" collapsible="icon">
            <DashboardSidebarHeader />

            <SidebarContent>
                <DashboardSidebarPages />
                <DashboardSidebarControl />
            </SidebarContent>

            <SidebarFooter>
                <DashboardSidebarUser client={client} />
            </SidebarFooter>
        </Sidebar>
    );
}
