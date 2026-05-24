import type { Platform } from "@/generated/prisma/browser";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

const colors: Record<Platform, string> = {
    META: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

interface PlatformBadgeProps {
    platform: Platform;
}

export function PlatformBadge({ platform }: PlatformBadgeProps) {
    return <Badge className={cn(colors[platform], "capitalize")}>{platform.toLowerCase()}</Badge>;
}
