"use client";

import { markNotificationsRead } from "@/actions/notification/mark-read";
import { useEffect, useRef } from "react";
import { NOTIFICATIONS_READ_EVENT } from "./read-event";

/** Marks the client's notifications as read once the notifications page is viewed. */
export function MarkNotificationsReadOnView() {
    const done = useRef(false);

    useEffect(() => {
        if (done.current) return;
        done.current = true;

        markNotificationsRead()
            // Tell the header's badge to clear. The rows on this page keep the tint they were
            // rendered with, so you can still see which ones were new on arrival.
            .then((count) => {
                if (count > 0) window.dispatchEvent(new Event(NOTIFICATIONS_READ_EVENT));
            })
            .catch(() => {});
    }, []);

    return null;
}
