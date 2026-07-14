"use client";

import { buttonVariants } from "@/components/ui/button";
import type { Platform } from "@/generated/prisma/browser";
import { PLATFORM_META } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { CONNECTABLE_PLATFORMS } from "@/lib/zernio/platform-map";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

interface ConnectButtonsProps {
    /** Platforms already connected — omitted from the list. */
    exclude?: Platform[];
    className?: string;
}

// Renders a "Connect <platform>" link per connectable platform (Meta today). Each kicks off the
// Zernio OAuth flow at /api/connect/<slug> — a full-page navigation that can take a few seconds
// (profile creation + OAuth URL fetch happen server-side before the redirect), so the clicked
// button shows a spinner until the browser leaves the page. Returns null when every connectable
// platform is excluded.
export function ConnectButtons({ exclude = [], className }: ConnectButtonsProps) {
    const [pending, setPending] = useState<Platform | null>(null);

    const platforms = CONNECTABLE_PLATFORMS.filter((p) => !exclude.includes(p.platform));
    if (platforms.length === 0) return null;

    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {platforms.map(({ platform, slug }) => {
                const { label, icon: Icon } = PLATFORM_META[platform];
                const isPending = pending === platform;
                return (
                    <a
                        key={platform}
                        href={`/api/connect/${slug}`}
                        onClick={() => setPending(platform)}
                        aria-disabled={pending !== null}
                        className={cn(buttonVariants(), pending !== null && "pointer-events-none opacity-70")}
                    >
                        {isPending ? <LoaderCircle className="animate-spin" /> : <Icon />}
                        {isPending ? "Connecting…" : `Connect ${label}`}
                    </a>
                );
            })}
        </div>
    );
}
