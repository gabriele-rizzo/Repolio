"use client";

import { NOTIFICATIONS_READ_EVENT } from "@/components/notifications/read-event";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function NotificationsBell({ unread }: { unread: number }) {
    const t = useTranslations("nav");

    // See components/notifications/read-event.ts: the page announces the read instead of the action
    // revalidating the whole dashboard layout, so the dot clears here rather than in a server pass.
    const [read, setRead] = useState(false);

    useEffect(() => {
        const clear = () => setRead(true);
        window.addEventListener(NOTIFICATIONS_READ_EVENT, clear);
        return () => window.removeEventListener(NOTIFICATIONS_READ_EVENT, clear);
    }, []);

    const count = read ? 0 : unread;

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
                        {count > 0 && (
                            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-blue-500 ring-2 ring-background" />
                        )}
                    </Link>
                }
            />

            <TooltipContent side="bottom" sideOffset={10}>
                <p>{count > 0 ? t("unreadCount", { count }) : t("notifications")}</p>
            </TooltipContent>
        </Tooltip>
    );
}
