"use client";

import React from "react";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Users, Globe, ChevronRight } from "lucide-react";
import { cn } from "@/app/lib/cn";

interface GroupCardProps {
    id: string;
    displayName: string;
    relayUrl: string;
    memberCount?: number;
    avatar?: string;
    onClick: () => void;
    className?: string;
}

export const GroupCard = ({ id, displayName, relayUrl, memberCount, avatar, onClick, className }: GroupCardProps) => {
    let relayHost = relayUrl;
    try {
        relayHost = new URL(relayUrl).hostname;
    } catch (e) {
        // Fallback to the raw string if URL parsing fails
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative flex flex-col p-6 bg-[#0E0E10] border border-[#1A1A1E] rounded-[32px] cursor-pointer transition-all duration-500 hover:border-purple-500/50 hover:bg-[#121216] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:-translate-y-1 active:scale-[0.98]",
                className
            )}
        >
            <div className="flex items-start justify-between mb-5">
                <Avatar className="h-14 w-14 rounded-2xl bg-zinc-900 text-white shadow-xl group-hover:scale-110 transition-transform duration-700 ease-out border border-white/5 overflow-hidden">
                    {avatar ? (
                        <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-black text-xl tracking-tighter w-full h-full flex items-center justify-center">
                            {displayName.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                    )}
                </Avatar>

                <div className="p-2.5 rounded-2xl bg-[#1A1A1E] text-zinc-500 group-hover:bg-white group-hover:text-black transition-all duration-300 shadow-inner">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>

            <div className="flex-1 space-y-2.5">
                <h4 className="font-black text-lg text-white tracking-tight truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-500 transition-all duration-300">
                    {displayName}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    <div className="p-1 rounded-sm bg-purple-500/10">
                        <Globe className="h-3 w-3 text-purple-400" />
                    </div>
                    <span className="truncate">{relayHost}</span>
                </div>
            </div>

            <div className="mt-5 pt-5 border-t border-white/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.05] backdrop-blur-sm">
                    <Users className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-[11px] font-black text-zinc-300">
                        {memberCount ?? 0}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                    <div className="h-1 w-1 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                        Active
                    </span>
                </div>
            </div>
        </div>
    );
};
