import { authorize } from "@/actions/auth/authorize";
import { DashboardSidebar } from "@/components/sidebar";
import { SIDEBAR_STATE_COOKIE } from "@/components/sidebar/config";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { decryptToken } from "@/lib/meta/crypto";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: React.PropsWithChildren) {
    const client = await authorize();
    if (!client) redirect("/auth/login");

    const store = await cookies();
    const open = store.get(SIDEBAR_STATE_COOKIE)?.value === "true";

    const connections = await prisma.accountConnection.findMany({
        where: { client_id: client.id },
    });

    const encrypted = connections.at(0)?.access_token;
    const token = encrypted ? decryptToken(encrypted) : undefined;

    return (
        <SidebarProvider defaultOpen={open}>
            <DashboardSidebar client={client} />

            {/* className="overflow-hidden" */}
            <SidebarInset>
                {children}
                <pre>{JSON.stringify(token, null, 2)}</pre>
            </SidebarInset>
        </SidebarProvider>
    );
}
