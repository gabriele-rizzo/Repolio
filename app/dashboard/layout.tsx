import { authorize } from "@/actions/auth/authorize";
import { DashboardHeader } from "@/components/header";
import { BreadcrumbProvider } from "@/components/header/context";
import { LanguageSwitcher } from "@/components/header/language-switcher";
import { NotificationsBell } from "@/components/header/notifications-bell";
import { AppShell } from "@/components/scaffolds/app-shell";
import { DashboardSidebar } from "@/components/sidebar";
import { SIDEBAR_STATE_COOKIE } from "@/components/sidebar/config";
import { signAvatarUrl } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const metadata: Metadata = {
    title: "Dashboard | Repolio",
};

export default async function DashboardLayout({ children }: React.PropsWithChildren) {
    const client = await authorize();
    const store = await cookies();

    const open = store.get(SIDEBAR_STATE_COOKIE)?.value === "true";

    const [connections, avatar, unread] = await Promise.all([
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
        prisma.notification.count({ where: { client_id: client.id, read_at: null } }),
    ]);

    const accountGroups = connections.map((connection) => ({
        platform: connection.platform,
        accounts: connection.ad_accounts,
    }));

    return (
        <BreadcrumbProvider>
            <AppShell
                defaultOpen={open}
                sidebar={<DashboardSidebar client={{ ...client, image: avatar }} accountGroups={accountGroups} />}
                header={
                    <DashboardHeader className="px-2">
                        <div className="flex flex-row items-center gap-1">
                            <LanguageSwitcher locale={client.locale} auto={client.locale_auto} />
                            <NotificationsBell unread={unread} />
                        </div>
                    </DashboardHeader>
                }
            >
                {children}
            </AppShell>
        </BreadcrumbProvider>
    );
}
