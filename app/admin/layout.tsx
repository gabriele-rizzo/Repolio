import { AdminSidebar } from "@/components/admin/sidebar";
import { Brand } from "@/components/brand";
import { AdminForm } from "@/components/forms/admin-form";
import { AppShell } from "@/components/scaffolds/app-shell";
import { SIDEBAR_STATE_COOKIE } from "@/components/sidebar/config";
import { SidebarTrigger } from "@/components/ui/sidebar";
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
        <AppShell
            defaultOpen={open}
            sidebar={<AdminSidebar />}
            header={
                <div className="flex h-12 items-center gap-2 border-b bg-background px-2">
                    <SidebarTrigger />
                </div>
            }
        >
            {children}
        </AppShell>
    );
}
