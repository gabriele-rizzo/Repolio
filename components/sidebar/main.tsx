"use client";

import { House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export function DashboardSidebarMain() {
    const path = usePathname();

    return (
        <SidebarGroup>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton
                        isActive={path === "/dashboard"}
                        render={
                            <Link href="/dashboard">
                                <House />
                                <span>Home</span>
                            </Link>
                        }
                    />
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
    );
}
