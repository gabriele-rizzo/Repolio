import { AdminForm } from "@/components/forms/admin-form";
import { isAdminAuthenticated } from "@/lib/admin/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
    const authenticated = await isAdminAuthenticated();

    return (
        <div className="size-full min-h-dvh items-center justify-center flex">
            {authenticated ? children : <AdminForm />}
        </div>
    );
}
