import { authorize } from "@/actions/auth/authorize";
import { DashboardHeader } from "@/components/header";
import { BreadcrumbProvider } from "@/components/header/context";
import { DashboardSidebar } from "@/components/sidebar";
import { SIDEBAR_STATE_COOKIE } from "@/components/sidebar/config";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { signAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
    title: "Dasboard | Repolio",
};

export default async function DashboardLayout({ children }: React.PropsWithChildren) {
    const client = await authorize();
    const store = await cookies();

    const open = store.get(SIDEBAR_STATE_COOKIE)?.value === "true";

    const [connections, avatar] = await Promise.all([
        prisma.platformConnection.findMany({
            where: { client_id: client.id },
            orderBy: { created_at: "asc" },
            select: {
                platform: true,
                ad_accounts: {
                    orderBy: { created_at: "asc" },
                    select: { id: true, external_id: true, name: true },
                },
            },
        }),
        signAvatarUrl(client.image),
    ]);

    const accountGroups = connections.map((connection) => ({
        platform: connection.platform,
        accounts: connection.ad_accounts,
    }));

    // WORK IN PROGRESS ONLY. TODO: remove
    if (process.env.NODE_ENV === "production" && client.email !== "gabrielerizzo.pers@gmail.com") {
        redirect("/wip");
    }

    return (
        <SidebarProvider defaultOpen={open} className="overscroll-none">
            <DashboardSidebar client={{ ...client, image: avatar }} accountGroups={accountGroups} />

            <SidebarInset className="flex flex-col overflow-hidden shrink-0 h-[calc(100vh-var(--spacing)*4)]! overscroll-none relative">
                <BreadcrumbProvider>
                    <div className="w-full overflow-y-auto overflow-x-hidden overscroll-x-none">
                        <div className="shrink-0 sticky top-0 z-10">
                            <DashboardHeader className="px-2">
                                <Tooltip>
                                    <Button
                                        variant="ghost"
                                        className="size-8!"
                                        render={
                                            <TooltipTrigger>
                                                <Bell />
                                                <span className="sr-only">Notifications</span>
                                            </TooltipTrigger>
                                        }
                                    />

                                    <TooltipContent side="bottom" sideOffset={10}>
                                        <p>Notifications</p>
                                    </TooltipContent>
                                </Tooltip>
                            </DashboardHeader>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">{children}</div>
                    </div>
                </BreadcrumbProvider>
            </SidebarInset>
        </SidebarProvider>
    );
}
