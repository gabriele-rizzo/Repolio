"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useMemo } from "react";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function DashboardSidebarControl() {
    const { open, toggleSidebar } = useSidebar();
    const label = useMemo(() => (open ? "Collapse" : "Expand"), [open]);

    return (
        <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <SidebarMenuButton size="sm" onClick={toggleSidebar}>
                                        <div className="z-0">{open ? <PanelLeftClose /> : <PanelLeftOpen />}</div>
                                        {open && <span>{label}</span>}
                                    </SidebarMenuButton>
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
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}
