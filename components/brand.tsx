import { Command } from "lucide-react";
import Link from "next/link";

export function Brand() {
    return (
        <Link href="/" className="flex items-center gap-2 text-foreground">
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command className="size-4" />
            </div>
            <span className="font-semibold">Repolio</span>
        </Link>
    );
}
