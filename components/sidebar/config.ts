import type { Client } from "@/generated/prisma/browser";
import { ChartPie, FileSpreadsheet, HardDrive, type LucideIcon } from "lucide-react";

export interface WithClientProps {
    client: Client;
}

interface Page {
    label: string;
    href: string;
    icon: LucideIcon;
}

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
    {
        label: "Snapshots",
        href: "/dashboard/snapshots",
        icon: HardDrive,
    },
];
