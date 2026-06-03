"use client";

import Image from "next/image";
import { cn } from "@dweb/ui-kit";

export interface CommunityInviteAvatarProps {
    displayName: string;
    pictureUrl?: string | null;
    compact?: boolean;
    className?: string;
}

export function CommunityInviteAvatar({
    displayName,
    pictureUrl,
    compact = false,
    className,
}: CommunityInviteAvatarProps): React.JSX.Element {
    const trimmedPicture = pictureUrl?.trim() ?? "";
    const initial = (displayName.trim().charAt(0) || "?").toUpperCase();

    return (
        <div
            className={cn(
                "relative shrink-0 overflow-hidden border border-purple-300/50 bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm dark:border-purple-500/30",
                compact ? "h-9 w-9 rounded-xl" : "h-11 w-11 rounded-2xl",
                className,
            )}
            aria-hidden
        >
            {trimmedPicture.length > 0 ? (
                <Image
                    src={trimmedPicture}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                />
            ) : (
                <span
                    className={cn(
                        "flex h-full w-full items-center justify-center font-black text-white",
                        compact ? "text-sm" : "text-base",
                    )}
                >
                    {initial}
                </span>
            )}
        </div>
    );
}
