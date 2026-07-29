import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export async function NotificationsBell({ unread }: { unread: number }) {
    const t = await getTranslations("nav");

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Link
                        href="/dashboard/notifications"
                        aria-label={t("notifications")}
                        className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "relative")}
                    >
                        <Bell />
                        {unread > 0 && (
                            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-blue-500 ring-2 ring-background" />
                        )}
                    </Link>
                }
            />

            <TooltipContent side="bottom" sideOffset={10}>
                <p>{unread > 0 ? t("unreadCount", { count: unread }) : t("notifications")}</p>
            </TooltipContent>
        </Tooltip>
    );
}
