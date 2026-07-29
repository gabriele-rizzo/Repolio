"use client";

import { House } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export function DashboardSidebarMain() {
    const path = usePathname();
    const t = useTranslations("nav");

    return (
        <SidebarGroup>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton
                        isActive={path === "/dashboard"}
                        render={
                            <Link href="/dashboard">
                                <House />
                                <span>{t("home")}</span>
                            </Link>
                        }
                    />
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
    );
}
