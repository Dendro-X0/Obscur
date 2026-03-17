"use client";

import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@dweb/ui-kit";
import { useResolvedProfileMetadata } from "../hooks/use-resolved-profile-metadata";
import { cn } from "@/app/lib/utils";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { getPublicProfileHref } from "@/app/features/navigation/public-routes";

interface UserAvatarProps {
    pubkey: string;
    className?: string;
    fallbackClassName?: string;
    size?: "sm" | "md" | "lg" | "xl";
    showProfileOnClick?: boolean;
    metadataLive?: boolean;
}

export const UserAvatar = ({
    pubkey,
    className,
    fallbackClassName,
    size = "md",
    showProfileOnClick = true,
    metadataLive = true,
}: UserAvatarProps) => {
    const metadata = useResolvedProfileMetadata(pubkey, { live: metadataLive });
    const router = useRouter();

    const sizeClasses = {
        sm: "h-6 w-6 text-[10px]",
        md: "h-10 w-10 text-sm",
        lg: "h-16 w-16 text-xl",
        xl: "h-24 w-24 text-3xl",
    };

    const { state: identityState } = useIdentity();
    const myPubkey = identityState.publicKeyHex ?? identityState.stored?.publicKeyHex;

    const handleClick = () => {
        if (!showProfileOnClick) return;

        if (pubkey === myPubkey) {
            router.push("/settings#profile");
        } else {
            router.push(getPublicProfileHref(pubkey));
        }
    };

    return (
        <Avatar
            className={cn(
                sizeClasses[size],
                showProfileOnClick && "cursor-pointer transition-transform hover:scale-105 active:scale-95",
                className
            )}
            onClick={handleClick}
        >
            {metadata?.avatarUrl && (
                <AvatarImage src={metadata.avatarUrl} alt={metadata.displayName || pubkey} />
            )}
            <AvatarFallback className={cn("font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 uppercase", fallbackClassName)}>
                {(metadata?.displayName || pubkey || "??").slice(0, 2).toUpperCase()}
            </AvatarFallback>
        </Avatar>
    );
};
