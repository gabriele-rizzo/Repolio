import { buttonVariants } from "@/components/ui/button";
import type { Platform } from "@/generated/prisma/browser";
import { PLATFORM_META } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { CONNECTABLE_PLATFORMS } from "@/lib/zernio/platform-map";

interface ConnectButtonsProps {
    /** Platforms already connected — omitted from the list. */
    exclude?: Platform[];
    className?: string;
}

// Renders a "Connect <platform>" link per connectable platform (Meta today). Each kicks off the
// Zernio OAuth flow at /api/connect/<slug>. Returns null when every connectable platform is excluded.
export function ConnectButtons({ exclude = [], className }: ConnectButtonsProps) {
    const platforms = CONNECTABLE_PLATFORMS.filter((p) => !exclude.includes(p.platform));
    if (platforms.length === 0) return null;

    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {platforms.map(({ platform, slug }) => {
                const { label, icon: Icon } = PLATFORM_META[platform];
                return (
                    <a key={platform} href={`/api/connect/${slug}`} className={buttonVariants()}>
                        <Icon />
                        Connect {label}
                    </a>
                );
            })}
        </div>
    );
}
