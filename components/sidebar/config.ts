import type { ConnectedClient } from "@/actions/auth/authorize";
import type { Platform } from "@/generated/prisma/browser";

export interface WithClientProps {
    client: ConnectedClient;
}

export interface SidebarAdAccount {
    id: number;
    external_id: string;
    name: string | null;
}

export interface SidebarAccountGroup {
    platform: Platform;
    accounts: SidebarAdAccount[];
}

export interface DashboardSidebarProps extends WithClientProps {
    accountGroups: SidebarAccountGroup[];
}

export const SIDEBAR_STATE_COOKIE = "sidebar_state";
