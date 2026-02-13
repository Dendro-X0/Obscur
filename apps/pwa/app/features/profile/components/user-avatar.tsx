"use client";

import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar";
import { useProfileMetadata } from "../hooks/use-profile-metadata";
import { cn } from "@/app/lib/utils";
import { useRouter } from "next/navigation";

interface UserAvatarProps {
    pubkey: string;
    className?: string;
    fallbackClassName?: string;
    size?: "sm" | "md" | "lg" | "xl";
    showProfileOnClick?: boolean;
}

export const UserAvatar = ({
    pubkey,
    className,
    fallbackClassName,
    size = "md",
    showProfileOnClick = true
}: UserAvatarProps) => {
    const metadata = useProfileMetadata(pubkey);
    const router = useRouter();

    const sizeClasses = {
        sm: "h-6 w-6 text-[10px]",
        md: "h-10 w-10 text-sm",
        lg: "h-16 w-16 text-xl",
        xl: "h-24 w-24 text-3xl",
    };

    const handleClick = () => {
        if (showProfileOnClick) {
            router.push(`/contacts/${pubkey}`);
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
                {(metadata?.displayName || pubkey).slice(0, 2).toUpperCase()}
            </AvatarFallback>
        </Avatar>
    );
};
