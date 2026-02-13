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
    onClick: () => void;
    className?: string;
}

export const GroupCard = ({ id, displayName, relayUrl, memberCount, onClick, className }: GroupCardProps) => {
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
                "group relative flex flex-col p-5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-zinc-200/50 dark:border-white/5 rounded-[32px] cursor-pointer transition-all duration-300 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 active:scale-[0.98]",
                className
            )}
        >
            <div className="flex items-start justify-between mb-4">
                <Avatar className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg group-hover:scale-110 transition-transform duration-500 border-none">
                    <AvatarFallback className="bg-transparent font-black text-xl">
                        {displayName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div className="flex flex-col items-end gap-1">
                    <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-400 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                        <ChevronRight className="h-4 w-4" />
                    </div>
                </div>
            </div>

            <div className="flex-1 space-y-2">
                <h4 className="font-black text-lg text-zinc-900 dark:text-zinc-50 truncate">
                    {displayName}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium">
                    <Globe className="h-3 w-3 text-purple-500" />
                    <span className="truncate">{relayHost}</span>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-black/[0.03] dark:border-white/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-1.5 bg-black/[0.02] dark:bg-white/[0.02] px-2.5 py-1 rounded-full border border-black/[0.03] dark:border-white/[0.03]">
                    <Users className="h-3 w-3 text-zinc-400" />
                    <span className="text-[10px] font-bold text-zinc-500">
                        {memberCount ?? 0} {memberCount === 1 ? 'member' : 'members'}
                    </span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2.5 py-1 rounded-full border border-purple-500/10">
                    Community
                </span>
            </div>
        </div>
    );
};
