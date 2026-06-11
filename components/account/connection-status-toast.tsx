"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Friendly copy for the error codes the connect callback can redirect with.
const ERROR_MESSAGES: Record<string, string> = {
    invalid_state: "Connection failed: the request expired or was invalid. Please try again.",
    no_ad_accounts: "No ad accounts were found on that account.",
    access_denied: "Connection cancelled.",
    connection_failed: "We couldn't complete the connection. Please try again.",
    plan_limit: "Connection limit reached. Please contact support to add more accounts.",
    unsupported_platform: "That platform isn't available to connect yet.",
};

interface ConnectionStatusToastProps {
    connected?: boolean;
    error?: string;
}

/**
 * Reads the connection status passed via the URL after an OAuth redirect, shows
 * a toast, then strips the params so it doesn't fire again on refresh.
 */
export function ConnectionStatusToast({ connected, error }: ConnectionStatusToastProps) {
    const pathname = usePathname();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current || (!connected && !error)) return;
        handled.current = true;

        if (error) toast.error(ERROR_MESSAGES[error] ?? error);
        else if (connected) toast.success("Account connected successfully.");

        window.history.replaceState(null, "", pathname);
    }, [connected, error, pathname]);

    return null;
}
