"use client";

import { uploadAvatar } from "@/actions/account/upload-avatar";
import { UserAvatar } from "@/components/user-avatar";
import { LoaderCircle, Pen } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface ProfileAvatarProps {
    name: string;
    image: string | null;
}

export function ProfileAvatar({ name, image }: ProfileAvatarProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);

    async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = ""; // allow re-selecting the same file
        if (!file) return;

        setLoading(true);

        const data = new FormData();
        data.set("file", file);

        try {
            await uploadAvatar(data);
            toast.success("Profile picture updated.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            type="button"
            className="relative w-fit group disabled:pointer-events-none"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            aria-label="Change profile picture"
        >
            <UserAvatar name={name} src={image} className="size-24 group-hover:opacity-75" fallbackClassName="text-2xl" />

            <div className="absolute size-7 flex items-center justify-center bg-muted bottom-0.5 right-0.5 border-4 border-card rounded-full">
                {loading ? (
                    <LoaderCircle className="size-3 animate-spin" />
                ) : (
                    <Pen className="size-3 group-hover:opacity-50" />
                )}
            </div>

            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
        </button>
    );
}
