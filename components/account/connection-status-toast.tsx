"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface ConnectionStatusToastProps {
    connected?: boolean;
    error?: string;
}

/**
 * Reads the connection status passed via the URL after an OAuth redirect, shows
 * a toast, then strips the params so it doesn't fire again on refresh.
 */
export function ConnectionStatusToast({ connected, error }: ConnectionStatusToastProps) {
    const t = useTranslations("connect");
    const pathname = usePathname();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current || (!connected && !error)) return;
        handled.current = true;

        // Known error codes map to friendly copy; anything else is shown verbatim.
        if (error) toast.error(t.has(error) ? t(error) : error);
        else if (connected) toast.success(t("success"));

        window.history.replaceState(null, "", pathname);
    }, [connected, error, pathname, t]);

    return null;
}
