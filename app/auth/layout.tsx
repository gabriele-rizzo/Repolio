import { Brand } from "@/components/brand";
import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/auth">) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
            <Brand />

            {children}

            <div className="flex gap-4 text-xs text-muted-foreground">
                <Link href="/privacy" className="transition-colors hover:text-foreground">
                    Privacy
                </Link>
                <Link href="/terms-of-service" className="transition-colors hover:text-foreground">
                    Terms
                </Link>
            </div>
        </div>
    );
}
