import type { ConnectedClient } from "@/actions/auth/authorize";
import { ChartPie, FileSpreadsheet, type LucideIcon } from "lucide-react";

export interface WithClientProps {
    client: ConnectedClient;
}

interface Page {
    label: string;
    href: string;
    icon: LucideIcon;
}

export const SIDEBAR_STATE_COOKIE = "sidebar_state";

export const pages: Page[] = [
    {
        label: "Overview",
        href: "/dashboard",
        icon: ChartPie,
    },
    {
        label: "Reports",
        href: "/dashboard/reports",
        icon: FileSpreadsheet,
    },
];
