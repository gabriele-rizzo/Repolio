import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

// Root 404: everything outside /dashboard (which has its own, shell-preserving one) — a mistyped
// marketing URL, a stale link to a removed legal page, an /api path hit by a browser. Previously these
// fell through to the framework's bare default page.
//
// A Server Component, so it can translate without shipping the message bundle: unlike error.tsx there
// is no interactivity here to hydrate.
export default async function NotFound() {
    const t = await getTranslations("notFound");

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
            <Brand />

            <Empty className="border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <FileQuestion />
                    </EmptyMedia>

                    <EmptyTitle>{t("title")}</EmptyTitle>
                    <EmptyDescription>{t("description")}</EmptyDescription>
                </EmptyHeader>

                <EmptyContent>
                    <Link href="/">
                        <Button>{t("home")}</Button>
                    </Link>
                </EmptyContent>
            </Empty>
        </div>
    );
}
