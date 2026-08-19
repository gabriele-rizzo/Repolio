"use client";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

// Shared body for the route-level error boundaries (app/dashboard, app/admin). Deliberately NOT used
// by app/global-error.tsx: that boundary replaces the root layout, so it has neither the intl
// provider nor the theme provider to render against — see the note there.
//
// Shape follows app/dashboard/not-found.tsx so a failure looks like a considered state of the product
// rather than a crash.

export interface ErrorStateProps {
    /** The boundary's `reset` — re-renders the segment without a full page load. */
    reset: () => void;
    /**
     * Next.js's stable hash for the underlying error. In production the message itself is withheld
     * from the client, so this is the only handle that ties what the user saw to a server log line.
     * Showing it is what makes "it broke" a reportable event instead of an anecdote.
     */
    digest?: string;
    /** Where "back" goes. Omit for a boundary with nowhere sensible to return to. */
    homeHref?: string;
}

export function ErrorState({ reset, digest, homeHref }: ErrorStateProps) {
    const t = useTranslations("error");

    return (
        <Empty className="border border-dashed">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <AlertTriangle />
                </EmptyMedia>

                <EmptyTitle>{t("title")}</EmptyTitle>
                <EmptyDescription>{t("description")}</EmptyDescription>
            </EmptyHeader>

            <EmptyContent>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {/* Retry first: a transient DB hiccup or a failed fetch clears on a re-render, and
                        reset() re-runs the segment without discarding the rest of the shell. */}
                    <Button onClick={reset}>{t("retry")}</Button>

                    {/* Link wrapping Button, matching app/dashboard/not-found.tsx — this Button has no
                        asChild slot. */}
                    {homeHref && (
                        <Link href={homeHref}>
                            <Button variant="outline">{t("backToOverview")}</Button>
                        </Link>
                    )}
                </div>

                {digest && <p className="text-muted-foreground mt-2 font-mono text-xs">{t("reference", { digest })}</p>}
            </EmptyContent>
        </Empty>
    );
}
