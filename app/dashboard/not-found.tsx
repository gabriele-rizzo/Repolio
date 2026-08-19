import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

// Dashboard 404: renders inside the app shell, so the sidebar and header stay put and the client can
// navigate on. The root app/not-found.tsx covers everything outside /dashboard.
//
// A Server Component — no interactivity to hydrate, so the message bundle stays off the client.
export default async function DashboardNotFound() {
    const t = await getTranslations("notFound");

    return (
        <Empty className="border border-dashed">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FileQuestion />
                </EmptyMedia>

                <EmptyTitle>{t("title")}</EmptyTitle>
                <EmptyDescription>{t("description")}</EmptyDescription>
            </EmptyHeader>

            <EmptyContent>
                <Link href="/dashboard">
                    <Button>{t("backToOverview")}</Button>
                </Link>
            </EmptyContent>
        </Empty>
    );
}
