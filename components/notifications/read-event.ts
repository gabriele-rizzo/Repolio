/**
 * Dispatched on `window` once the notifications page has marked everything read.
 *
 * The unread badge lives in the dashboard layout, which a client-side navigation never re-runs, so
 * the count it was rendered with is whatever the last full page load returned. The obvious fix —
 * `revalidatePath("/dashboard", "layout")` from the server action — also evicts every prefetched
 * route from the client router cache, so the badge cleared itself at the cost of making the next
 * click in the sidebar a cold server round trip again. This event lets the badge update in place
 * and leaves the cache alone.
 */
export const NOTIFICATIONS_READ_EVENT = "repolio:notifications-read";
