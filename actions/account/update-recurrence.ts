"use server";

import { authorize } from "@/actions/auth/authorize";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const MIN_DAYS = 1;
const MAX_DAYS = 365;

export async function updateRecurrence(ndays: number) {
    if (!Number.isFinite(ndays) || ndays < MIN_DAYS || ndays > MAX_DAYS) {
        throw new Error("Choose a cadence between 1 and 365 days.");
    }

    const client = await authorize();

    await prisma.recurrence.upsert({
        where: { client_id: client.id },
        create: { client_id: client.id, ndays },
        update: { ndays },
    });

    revalidatePath("/dashboard/account");
    revalidatePath("/dashboard/reports");
}
