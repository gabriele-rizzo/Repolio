"use client";

import { Brand } from "@/components/brand";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CalendarClock, DatabaseBackup, FlaskConical, HeartPulse, LayoutTemplate, MailCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
    { href: "/admin/enrollment", label: "Enrollment", icon: UserPlus },
    { href: "/admin/schedule", label: "Schedule", icon: CalendarClock },
    { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/admin/validation", label: "Validation", icon: MailCheck },
    { href: "/admin/simulation", label: "Simulation", icon: FlaskConical },
    { href: "/admin/health", label: "Health", icon: HeartPulse },
    { href: "/admin/recovery", label: "Recovery", icon: DatabaseBackup },
] as const;

export function AdminSidebar() {
    const path = usePathname();

    return (
        <Sidebar variant="inset" collapsible="icon" className="overscroll-none *:**:overscroll-none">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem className="w-fit">
                        <SidebarMenuButton size="lg">
                            <Brand label="Admin" href="/admin" />
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {NAV.map(({ href, label, icon: Icon }) => (
                            <SidebarMenuItem key={href}>
                                <SidebarMenuButton
                                    isActive={path === href || path.startsWith(`${href}/`)}
                                    tooltip={label}
                                    render={
                                        <Link href={href}>
                                            <Icon />
                                            <span>{label}</span>
                                        </Link>
                                    }
                                />
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
