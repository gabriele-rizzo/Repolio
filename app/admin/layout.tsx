import { Brand } from "@/components/brand";
import { AdminForm } from "@/components/forms/admin-form";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
    const authenticated = await isAdminAuthenticated();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
            <Brand />
            {authenticated ? children : <AdminForm />}
        </div>
    );
}
