"use client";

import { markNotificationsRead } from "@/actions/notification/mark-read";
import { useEffect, useRef } from "react";

/** Marks the client's notifications as read once the notifications page is viewed. */
export function MarkNotificationsReadOnView() {
    const done = useRef(false);

    useEffect(() => {
        if (done.current) return;
        done.current = true;
        markNotificationsRead().catch(() => {});
    }, []);

    return null;
}
