"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { pages } from "./config";

export function DashboardSidebarPages() {
    const path = usePathname();
    const { open } = useSidebar();

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Pages</SidebarGroupLabel>

            <SidebarMenu>
                <SidebarMenuItem>
                    {pages.map(({ label, icon: Icon, href }) => {
                        const active = path === href;

                        return (
                            <Tooltip key={label}>
                                <TooltipTrigger
                                    render={
                                        <SidebarMenuButton
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
                                    }
                                />

                                <TooltipContent
                                    side="right"
                                    sideOffset={10}
                                    className="aria-disabled:hidden"
                                    aria-disabled={open}
                                >
                                    <p>{label}</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
    );
}
