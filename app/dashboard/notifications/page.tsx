import { authorize } from "@/actions/auth/authorize";
import { MarkNotificationsReadOnView } from "@/components/notifications/mark-read-on-view";
import { PageScaffold } from "@/components/scaffolds/page-scaffold";
import { Typo } from "@/components/typography";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { type NotificationType } from "@/generated/prisma/enums";
import { dateFormatRelative } from "@/lib/date/format-relative";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Bell, FileText, Link2Off, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Notifications",
};

const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
    REPORT_READY: FileText,
    CONNECTION_EXPIRING: TriangleAlert,
    CONNECTION_EXPIRED: Link2Off,
};

export default async function NotificationsPage() {
    const [client, t, locale, tDate] = await Promise.all([
        authorize(),
        getTranslations("notifications"),
        getLocale(),
        getTranslations("date"),
    ]);

    const notifications = await prisma.notification.findMany({
        where: { client_id: client.id },
        orderBy: { created_at: "desc" },
        take: 50,
    });

    return (
        <PageScaffold title={t("title")} description={t("description")}>
            <MarkNotificationsReadOnView />

            {notifications.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Bell />
                        </EmptyMedia>

                        <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                        <EmptyDescription>{t("emptyBody")}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <div className="divide-y overflow-hidden rounded-lg border">
                    {notifications.map((notification) => {
                        const unread = !notification.read_at;
                        const Icon = NOTIFICATION_ICON[notification.type];

                        const content = (
                            <>
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                                    <Icon className="size-4" />
                                </div>

                                <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex flex-row items-center gap-2">
                                        <Typo as="small" className="truncate">
                                            {notification.title}
                                        </Typo>
                                        {unread && <span className="size-2 shrink-0 rounded-full bg-blue-500" />}
                                    </div>

                                    {notification.body && (
                                        <Typo as="muted" className="text-sm">
                                            {notification.body}
                                        </Typo>
                                    )}

                                    <Typo as="muted" className="text-xs">
                                        {dateFormatRelative(notification.created_at, { locale, t: tDate })}
                                    </Typo>
                                </div>
                            </>
                        );

                        const className = cn(
                            "flex flex-row items-start gap-3 p-4 transition-colors",
                            unread && "bg-muted/30",
                            notification.link && "hover:bg-muted/50",
                        );

                        return notification.link ? (
                            <Link key={notification.id} href={notification.link} className={className}>
                                {content}
                            </Link>
                        ) : (
                            <div key={notification.id} className={className}>
                                {content}
                            </div>
                        );
                    })}
                </div>
            )}
        </PageScaffold>
    );
}
