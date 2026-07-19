import { AdminSidebar } from "@/components/admin/sidebar";
import { Brand } from "@/components/brand";
import { AdminForm } from "@/components/forms/admin-form";
import { SIDEBAR_STATE_COOKIE } from "@/components/sidebar/config";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { cookies } from "next/headers";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
    const authenticated = await isAdminAuthenticated();

    // Unauthenticated: keep the centered OTP prompt (no dashboard shell to leak behind it).
    if (!authenticated) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
                <Brand />
                <AdminForm />
            </div>
        );
    }

    const store = await cookies();
    // Default open when there's no stored preference — the admin nav is short and reads better expanded.
    const open = store.get(SIDEBAR_STATE_COOKIE)?.value !== "false";

    return (
        <SidebarProvider defaultOpen={open} className="overscroll-none">
            <AdminSidebar />

            <SidebarInset className="flex flex-col overflow-hidden shrink-0 h-[calc(100vh-var(--spacing)*4)]! overscroll-none relative">
                <div className="w-full overflow-y-auto overflow-x-hidden overscroll-x-none">
                    <div className="shrink-0 sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/70 px-2 backdrop-blur print:hidden">
                        <SidebarTrigger />
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">{children}</div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
