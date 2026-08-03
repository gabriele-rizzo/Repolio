"use client";

import { PageScaffold } from "@/components/scaffolds/page-scaffold";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

// A Client Component on purpose. A Suspense fallback has to render without awaiting anything — an
// async `getTranslations()` here would make the fallback itself suspend, which is exactly the wait
// this file exists to remove (and would keep the router from prefetching the shell). `useTranslations`
// reads the messages already handed to NextIntlClientProvider in the root layout, so the heading is
// real text from the first frame and only the rows below it are placeholders.
export default function NotificationsLoading() {
    const t = useTranslations("notifications");

    return (
        <PageScaffold title={t("title")} description={t("description")}>
            <div className="divide-y overflow-hidden rounded-lg border">
                {/* Mirrors the row in page.tsx: size-9 icon tile, then title / body / timestamp.
                    Uneven widths so the placeholder reads as a list of messages, not a table. */}
                {[
                    "w-40",
                    "w-56",
                    "w-44",
                    "w-52",
                    "w-36",
                ].map((width, index) => (
                    <div key={index} className="flex flex-row items-start gap-3 p-4">
                        <Skeleton className="size-9 shrink-0 rounded-lg" />

                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className={`h-3.5 max-w-full ${width}`} />
                            <Skeleton className="h-3.5 w-full max-w-md" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </div>
                ))}
            </div>
        </PageScaffold>
    );
}
