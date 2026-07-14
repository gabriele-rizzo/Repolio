"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface LoginErrorToastProps {
    error?: string;
}

/**
 * Surfaces an auth error passed via ?error= (e.g. an expired/invalid invite bounced from
 * /auth/confirm) as a toast, then strips the param so it doesn't fire again on refresh.
 */
export function LoginErrorToast({ error }: LoginErrorToastProps) {
    const pathname = usePathname();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current || !error) return;
        handled.current = true;

        // Defer to a macrotask: firing toast() synchronously during the mount effect races the
        // sonner Toaster's own mount/subscribe and the toast gets dropped on a full page load
        // (which is exactly how users arrive here — redirected from /auth/confirm).
        const id = setTimeout(() => {
            toast.error(error);
            window.history.replaceState(null, "", pathname);
        }, 0);
        return () => clearTimeout(id);
    }, [error, pathname]);

    return null;
}
