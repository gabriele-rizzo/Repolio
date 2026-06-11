import type { Platform } from "@/generated/prisma/browser";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

const colors: Record<Platform, string> = {
    META: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    GOOGLE: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    TIKTOK: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
    LINKEDIN: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    PINTEREST: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    X: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
};

interface PlatformBadgeProps {
    platform: Platform;
}

export function PlatformBadge({ platform }: PlatformBadgeProps) {
    return <Badge className={cn(colors[platform], "capitalize")}>{platform.toLowerCase()}</Badge>;
}
