"use server";

import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";

export async function markNotificationsRead() {
    const client = await authorize();

    const { count } = await prisma.notification.updateMany({
        where: { client_id: client.id, read_at: null },
        data: { read_at: new Date() },
    });

    // Deliberately no revalidatePath: the only thing the write changes on screen is the header's
    // unread dot, and revalidating the dashboard layout to move one dot also threw away every
    // prefetched route in the client router cache — so opening notifications made the whole app
    // navigate cold afterwards. The caller clears the badge instead; see
    // components/notifications/read-event.ts.
    return count;
}
