"use client";

import { Suspense } from "react";
import { Sidebar, SidebarContent, SidebarFooter } from "../ui/sidebar";
import { DashboardSidebarAccounts } from "./accounts";
import type { DashboardSidebarProps } from "./config";
import { DashboardSidebarHeader } from "./header";
import { DashboardSidebarUser } from "./user";

export function DashboardSidebar({ client, accountGroups }: DashboardSidebarProps) {
    return (
        <Sidebar variant="inset" collapsible="icon" className="overscroll-none *:**:overscroll-none">
            <DashboardSidebarHeader />

            <SidebarContent>
                <Suspense fallback={null}>
                    <DashboardSidebarAccounts groups={accountGroups} />
                </Suspense>
            </SidebarContent>

            <SidebarFooter>
                <DashboardSidebarUser client={client} />
            </SidebarFooter>
        </Sidebar>
    );
}
