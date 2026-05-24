"use state";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { userInitials } from "@/lib/user/initials";
import { useMemo } from "react";
import type { WithClientProps } from "../config";

export function DashboardSidebarUserInfos({ client }: WithClientProps) {
    const initials = useMemo(() => userInitials(client.name), [client.name]);

    return (
        <>
            <Avatar className="size-8">
                {/* <AvatarImage src={user.avatar} alt={user.name} /> */}
                <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{client.name}</span>
                <span className="truncate text-xs text-muted-foreground">{client.company}</span>
            </div>
        </>
    );
}
