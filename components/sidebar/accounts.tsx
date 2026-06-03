"use client";

import { PLATFORM_META } from "@/lib/platform";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

    const hasAccounts = groups.some((group) => group.accounts.length > 0);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Accounts</SidebarGroupLabel>

            <SidebarMenu>
                {!hasAccounts ? (
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            render={
                                <a href="/api/meta/connect">
                                    <Plus />
                                    <span>Connect an account</span>
                                </a>
                            }
                        />
                    </SidebarMenuItem>
                ) : (
                    groups.map(({ platform, accounts }) => {
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
                                            path.startsWith("/dashboard/reports") &&
                                            activeAccount === String(account.id);

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
                    })
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
