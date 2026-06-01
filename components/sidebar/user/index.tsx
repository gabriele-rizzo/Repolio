"use client";

import { logout } from "@/actions/auth/logout";
import { cn } from "@/lib/utils";
import { BadgeCheck, Bell, ChevronsUpDown, LogOut } from "lucide-react";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../../ui/sidebar";
import type { WithClientProps } from "../config";
import { DashboardSidebarUserInfos } from "./infos";

export function DashboardSidebarUser({ client }: WithClientProps) {
    const { open, isMobile } = useSidebar();
    const infos = <DashboardSidebarUserInfos client={client} />;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <SidebarMenuButton size="lg" className={cn(!open && "hover:bg-transparent")}>
                                {infos}
                                <ChevronsUpDown className="ml-auto size-4" />
                            </SidebarMenuButton>
                        }
                    />

                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "top"}
                        align={isMobile ? "end" : "center"}
                        sideOffset={4}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="p-0 font-normal">
                                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">{infos}</div>
                            </DropdownMenuLabel>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                render={
                                    <Link href="/dashboard/account">
                                        <BadgeCheck />
                                        Account
                                    </Link>
                                }
                            />

                            <DropdownMenuItem
                                render={
                                    <Link href="/dashboard/notifications">
                                        <Bell />
                                        Notifications
                                    </Link>
                                }
                            />
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={logout} className="text-destructive">
                            <LogOut />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
