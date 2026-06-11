"use client";

import { PLATFORM_META } from "@/lib/platform";
import { CONNECTABLE_PLATFORMS } from "@/lib/zernio/platform-map";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "../ui/sidebar";
import type { SidebarAccountGroup } from "./config";

interface DashboardSidebarAccountsProps {
    groups: SidebarAccountGroup[];
}

export function DashboardSidebarAccounts({ groups }: DashboardSidebarAccountsProps) {
    const path = usePathname();
    const params = useSearchParams();
    const activeAccount = params.get("account");

    const connectedGroups = groups.filter((group) => group.accounts.length > 0);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Accounts</SidebarGroupLabel>

            <SidebarMenu>
                {connectedGroups.map(({ platform, accounts }) => {
                    const { label, icon: Icon } = PLATFORM_META[platform];

                    return (
                        <SidebarMenuItem key={platform}>
                            <SidebarMenuButton className="pointer-events-none font-medium text-sidebar-foreground/70">
                                <Icon />
                                <span>{label}</span>
                            </SidebarMenuButton>

                            <SidebarMenuSub>
                                {accounts.map((account) => {
                                    const active =
                                        path.startsWith("/dashboard/reports") && activeAccount === String(account.id);

                                    return (
                                        <SidebarMenuSubItem key={account.id}>
                                            <SidebarMenuSubButton
                                                isActive={active}
                                                render={
                                                    <Link href={`/dashboard/reports?account=${account.id}`}>
                                                        <span>{account.name ?? account.external_id}</span>
                                                    </Link>
                                                }
                                            />
                                        </SidebarMenuSubItem>
                                    );
                                })}
                            </SidebarMenuSub>
                        </SidebarMenuItem>
                    );
                })}

                {/* Always present — with or without existing accounts — so a client can connect another
                    ad account at any time. (The old UI only offered connect buttons in the empty state.) */}
                <AddConnection />
            </SidebarMenu>
        </SidebarGroup>
    );
}

// Entry point to start another Zernio connect. With a single connectable platform (Meta today) it
// links straight to its OAuth; with several it opens a menu to pick which one to connect.
function AddConnection() {
    if (CONNECTABLE_PLATFORMS.length === 0) return null;

    if (CONNECTABLE_PLATFORMS.length === 1) {
        const { slug } = CONNECTABLE_PLATFORMS[0];
        return (
            <SidebarMenuItem>
                <SidebarMenuButton
                    tooltip="Add connection"
                    render={
                        <a href={`/api/connect/${slug}`}>
                            <Plus />
                            <span>Add connection</span>
                        </a>
                    }
                />
            </SidebarMenuItem>
        );
    }

    return (
        <SidebarMenuItem>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <SidebarMenuButton>
                            <Plus />
                            <span>Add connection</span>
                        </SidebarMenuButton>
                    }
                />

                <DropdownMenuContent side="right" align="start" className="min-w-40">
                    {CONNECTABLE_PLATFORMS.map(({ platform, slug }) => {
                        const { label, icon: Icon } = PLATFORM_META[platform];
                        return (
                            <DropdownMenuItem
                                key={platform}
                                render={
                                    <a href={`/api/connect/${slug}`}>
                                        <Icon />
                                        Connect {label}
                                    </a>
                                }
                            />
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    );
}
