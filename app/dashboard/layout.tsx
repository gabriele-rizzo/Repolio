import { authorize } from "@/actions/auth/authorize";
import { DashboardHeader } from "@/components/header";
import { BreadcrumbProvider } from "@/components/header/context";
import { DashboardSidebar } from "@/components/sidebar";
import { SIDEBAR_STATE_COOKIE } from "@/components/sidebar/config";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
    title: "Dasboard | Repolio",
};

export default async function DashboardLayout({ children }: React.PropsWithChildren) {
    const client = await authorize();
    const store = await cookies();

    const open = store.get(SIDEBAR_STATE_COOKIE)?.value === "true";

    return (
        <SidebarProvider defaultOpen={open} className="overscroll-none">
            <DashboardSidebar client={client} />

            <SidebarInset className="flex flex-col overflow-hidden shrink-0 h-[calc(100vh-var(--spacing)*4)]! overscroll-none relative">
                <BreadcrumbProvider>
                    <div className="w-full overflow-scroll overscroll-x-none">
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
