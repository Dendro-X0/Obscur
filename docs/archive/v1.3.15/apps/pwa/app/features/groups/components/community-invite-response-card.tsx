"use client";

import React from "react";
import { PartyPopper, Ban, X } from "lucide-react";
import { cn } from "@dweb/ui-kit";

export interface CommunityInviteResponseContent {
    type: "community-invite-response";
    status: "accepted" | "declined" | "canceled";
    groupId: string;
}

interface CommunityInviteResponseCardProps {
    response: CommunityInviteResponseContent;
    isOutgoing: boolean;
}

export const CommunityInviteResponseCard: React.FC<CommunityInviteResponseCardProps> = ({
    response,
    isOutgoing
}) => {
    const isAccepted = response.status === "accepted";
    const isDeclined = response.status === "declined";
    const isCanceled = response.status === "canceled";

    return (
        <div className={cn(
            "flex items-center gap-3 py-1 px-1",
            isOutgoing ? "justify-end" : "justify-start"
        )}>
            <div className={cn(
                "flex items-center gap-2 py-2.5 px-4 rounded-2xl border transition-all duration-300 max-w-fit shadow-sm",
                isAccepted
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : isDeclined
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                        : "bg-zinc-500/10 border-zinc-500/20 text-zinc-500 shadow-none border-zinc-200/50 dark:border-white/5"
            )}>
                {isAccepted ? (
                    <PartyPopper className="h-4 w-4 animate-bounce" />
                ) : isDeclined ? (
                    <Ban className="h-4 w-4" />
                ) : (
                    <X className="h-4 w-4" />
                )}
                <span className="text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap">
                    {isAccepted ? "Invitation Accepted" : isDeclined ? "Invitation Declined" : "Invitation Canceled"}
                </span>
            </div>
        </div>
    );
};
