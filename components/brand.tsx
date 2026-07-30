import Logo from "@/app/icon0.svg";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

type BrandProps = { label: string; href: `/${string}` } | { label?: undefined; href?: undefined };

export function Brand({ label, href }: BrandProps) {
    return (
        <Link href={href ?? "/"} className={cn("flex flex-row gap-2", !label && !href && "p-2 hover:bg-muted")}>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[#b7d9bb] text-sidebar-primary-foreground">
                <Image src={Logo} alt="logo" width={64} height={64} className="size-8" />
            </div>

            <div className="grid flex-1 text-left text-sm leading-tight items-center">
                <span className="truncate font-medium">Repolio</span>
                {label && <span className="truncate text-xs text-muted-foreground capitalize">{label}</span>}
            </div>
        </Link>
    );
}
