"use server";

import { authorize } from "@/actions/auth/authorize";
import { AVATAR_BUCKET } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Verify the real file signature rather than trusting the client-provided MIME type.
function sniffImageType(bytes: Uint8Array): string | null {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
    if (
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
        return "image/webp";
    }
    return null;
}

export async function uploadAvatar(formData: FormData): Promise<void> {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) throw new Error("No image provided.");
    if (file.size > MAX_BYTES) throw new Error("Image must be 5MB or smaller.");
    if (!ALLOWED.includes(file.type)) throw new Error("Use a PNG, JPEG, WEBP or GIF image.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = sniffImageType(buffer);
    if (!contentType) throw new Error("That file is not a valid image.");

    const client = await authorize();

    // Service role bypasses storage RLS; the bucket can stay private.
    const supabase = createServiceClient();

    // One stable object per client; overwrite on re-upload.
    const path = `${client.id}`;
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, buffer, {
        upsert: true,
        contentType,
    });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // Store only the object path — URLs are signed on demand at render time.
    await prisma.client.update({ where: { id: client.id }, data: { image: path } });

    revalidatePath("/dashboard", "layout");
}
