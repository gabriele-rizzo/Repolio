"use client";

import { House, LayoutTemplate } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

const NAV = [
    { href: "/dashboard", label: "home", icon: House, exact: true },
    { href: "/dashboard/template", label: "reportTemplate", icon: LayoutTemplate, exact: false },
] as const;

export function DashboardSidebarMain() {
    const path = usePathname();
    const t = useTranslations("nav");

    return (
        <SidebarGroup>
            <SidebarMenu>
                {NAV.map(({ href, label, icon: Icon, exact }) => (
                    <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                            isActive={exact ? path === href : path === href || path.startsWith(`${href}/`)}
                            render={
                                <Link href={href}>
                                    <Icon />
                                    <span>{t(label)}</span>
                                </Link>
                            }
                        />
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
