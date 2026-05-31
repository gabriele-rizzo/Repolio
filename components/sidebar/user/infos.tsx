"use client";

import { UserAvatar } from "@/components/user-avatar";
import type { WithClientProps } from "../config";

export function DashboardSidebarUserInfos({ client }: WithClientProps) {
    return (
        <>
            <UserAvatar name={client.name} src={client.image} className="size-8" />

            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{client.name}</span>
                <span className="truncate text-xs text-muted-foreground">{client.company}</span>
            </div>
        </>
    );
}
