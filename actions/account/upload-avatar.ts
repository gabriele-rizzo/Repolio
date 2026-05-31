"use server";

import { authorize } from "@/actions/auth/authorize";
import { AVATAR_BUCKET } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function uploadAvatar(formData: FormData): Promise<void> {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) throw new Error("No image provided.");
    if (file.size > MAX_BYTES) throw new Error("Image must be 5MB or smaller.");
    if (!ALLOWED.includes(file.type)) throw new Error("Use a PNG, JPEG, WEBP or GIF image.");

    const client = await authorize();

    // Service role bypasses storage RLS; the bucket can stay private.
    const supabase = createServiceClient();

    // One stable object per client; overwrite on re-upload.
    const path = `${client.id}`;
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
    });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // Store only the object path — URLs are signed on demand at render time.
    await prisma.client.update({ where: { id: client.id }, data: { image: path } });

    revalidatePath("/dashboard", "layout");
}
