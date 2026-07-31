"use client";

import { PLATFORM_META } from "@/lib/platform";
import { CONNECTABLE_PLATFORMS } from "@/lib/zernio/platform-map";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
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
    useSidebar,
} from "../ui/sidebar";
import type { SidebarAccountGroup } from "./config";

interface DashboardSidebarAccountsProps {
    groups: SidebarAccountGroup[];
}

export function DashboardSidebarAccounts({ groups }: DashboardSidebarAccountsProps) {
    const path = usePathname();
    const params = useSearchParams();
    const activeAccount = params.get("account");
    const t = useTranslations("nav");
    const { state, isMobile } = useSidebar();

    // Collapsed to icons, SidebarMenuSub is display:none — every account link disappears and the only
    // thing left in this group is the platform icon, which is a non-interactive label. That left the
    // whole Accounts section dead: an icon you can't click and no way to reach an account without
    // expanding first. Collapsed, the icon becomes a menu of that platform's accounts instead.
    const collapsed = state === "collapsed" && !isMobile;

    const connectedGroups = groups.filter((group) => group.accounts.length > 0);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>{t("accounts")}</SidebarGroupLabel>

            <SidebarMenu>
                {connectedGroups.map(({ platform, accounts }) => {
                    const { label, icon: Icon } = PLATFORM_META[platform];

                    const isActive = (accountId: number) =>
                        path.startsWith("/dashboard/reports") && activeAccount === String(accountId);

                    if (collapsed) {
                        return (
                            <SidebarMenuItem key={platform}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={
                                            <SidebarMenuButton tooltip={label}>
                                                <Icon />
                                                <span>{label}</span>
                                            </SidebarMenuButton>
                                        }
                                    />

                                    <DropdownMenuContent side="right" align="start" className="min-w-48">
                                        {accounts.map((account) => (
                                            <DropdownMenuItem
                                                key={account.id}
                                                render={
                                                    <Link href={`/dashboard/reports?account=${account.id}`}>
                                                        <span className="truncate">
                                                            {account.name ?? account.external_id}
                                                        </span>
                                                    </Link>
                                                }
                                            />
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuItem>
                        );
                    }

                    return (
                        <SidebarMenuItem key={platform}>
                            {/* Expanded, this is a heading for the sub-list below it, not a target. */}
                            <SidebarMenuButton className="pointer-events-none font-medium text-sidebar-foreground/70">
                                <Icon />
                                <span>{label}</span>
                            </SidebarMenuButton>

                            <SidebarMenuSub>
                                {accounts.map((account) => (
                                    <SidebarMenuSubItem key={account.id}>
                                        <SidebarMenuSubButton
                                            isActive={isActive(account.id)}
                                            render={
                                                <Link href={`/dashboard/reports?account=${account.id}`}>
                                                    <span>{account.name ?? account.external_id}</span>
                                                </Link>
                                            }
                                        />
                                    </SidebarMenuSubItem>
                                ))}
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
    const t = useTranslations("nav");

    if (CONNECTABLE_PLATFORMS.length === 0) return null;

    if (CONNECTABLE_PLATFORMS.length === 1) {
        const { slug } = CONNECTABLE_PLATFORMS[0];
        return (
            <SidebarMenuItem>
                <SidebarMenuButton
                    tooltip={t("addConnection")}
                    render={
                        <a href={`/api/connect/${slug}`}>
                            <Plus />
                            <span>{t("addConnection")}</span>
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
                            <span>{t("addConnection")}</span>
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
                                        {t("connect", { platform: label })}
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
