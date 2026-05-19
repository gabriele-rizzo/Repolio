"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { pages } from "./config";

export function DashboardSidebarPages() {
    const path = usePathname();

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Pages</SidebarGroupLabel>

            <SidebarMenu>
                <SidebarMenuItem>
                    {pages.map(({ label, icon: Icon, href }) => {
                        const active = path === href;

                        return (
                            <SidebarMenuButton
                                key={label}
                                render={
                                    active ? (
                                        <Button className="justify-start! pointer-events-none">
                                            <Icon />
                                            <span>{label}</span>
                                        </Button>
                                    ) : (
                                        <Link href={href}>
                                            <Icon />
                                            <span>{label}</span>
                                        </Link>
                                    )
                                }
                            />
                        );
                    })}
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
    );
}
