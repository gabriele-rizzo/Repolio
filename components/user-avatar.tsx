"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { userInitials } from "@/lib/user/initials";
import { useState } from "react";

interface UserAvatarProps {
    name: string;
    src: string | null;
    className?: string;
    fallbackClassName?: string;
}

/**
 * Avatar that shows a pulsing skeleton *in place of* the avatar while the image
 * loads, then the image once ready, falling back to the user's initials when
 * there is no image or it fails to load.
 */
export function UserAvatar({ name, src, className, fallbackClassName }: UserAvatarProps) {
    // Start in the loading state whenever we have a src to fetch.
    const [loading, setLoading] = useState(Boolean(src));

    return (
        <Avatar className={className}>
            {src && (
                <AvatarImage
                    src={src}
                    alt={name}
                    onLoadingStatusChange={(status) => setLoading(status === "loading")}
                />
            )}

            {loading ? (
                <Skeleton className="absolute inset-0 size-full rounded-full" />
            ) : (
                <AvatarFallback className={fallbackClassName}>{userInitials(name)}</AvatarFallback>
            )}
        </Avatar>
    );
}
