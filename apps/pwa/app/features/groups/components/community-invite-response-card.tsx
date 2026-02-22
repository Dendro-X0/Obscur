"use client";

import React from "react";
import { PartyPopper, Ban } from "lucide-react";
import { cn } from "@/app/lib/cn";

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
                "group relative overflow-hidden flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all duration-300",
                isAccepted
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : isDeclined
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                        : "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
            )}>
                {/* Glossy overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />

                <div className={cn(
                    "p-1 rounded-full",
                    isAccepted ? "bg-emerald-500/20" : isDeclined ? "bg-amber-500/20" : "bg-zinc-500/20"
                )}>
                    {isAccepted ? (
                        <PartyPopper className="w-3.5 h-3.5 animate-bounce" />
                    ) : (
                        <Ban className="w-3.5 h-3.5" />
                    )}
                </div>

                <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                    {isAccepted ? "Invitation Accepted" : isDeclined ? "Invitation Declined" : "Invitation Canceled"}
                </span>

                {isAccepted && (
                    <div className="absolute -right-2 -top-2 w-8 h-8 bg-emerald-500/10 blur-xl rounded-full" />
                )}
            </div>
        </div>
    );
};
