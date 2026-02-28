"use client";

import React from "react";
import { Avatar, AvatarFallback } from "@dweb/ui-kit";
import { Users, Globe, ChevronRight } from "lucide-react";
import { cn } from "@dweb/ui-kit";

interface GroupCardProps {
    id: string;
    displayName: string;
    relayUrl: string;
    memberCount?: number;
    avatar?: string;
    onClick: () => void;
    className?: string;
    viewMode?: "list" | "grid";
}

export const GroupCard = ({ id, displayName, relayUrl, memberCount, avatar, onClick, className, viewMode = "list" }: GroupCardProps) => {
    let relayHost = relayUrl;
    try {
        relayHost = new URL(relayUrl).hostname;
    } catch (e) {
        // Fallback to the raw string if URL parsing fails
    }

    if (viewMode === "list") {
        return (
            <div
                onClick={onClick}
                className={cn(
                    "group flex items-center justify-between p-3 bg-transparent hover:bg-muted/50 border-b border-border cursor-pointer transition-all",
                    className
                )}
            >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 rounded-xl bg-muted text-foreground shadow-sm border border-border overflow-hidden shrink-0">
                        {avatar ? (
                            <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-black text-sm tracking-tighter w-full h-full flex items-center justify-center text-white">
                                {displayName.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                        )}
                    </Avatar>

                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {displayName}
                            </h4>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono truncate">
                            <Globe className="h-3 w-3 shrink-0" />
                            <span className="truncate">{relayHost}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md border border-border">
                        <Users className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-bold text-muted-foreground">
                            {memberCount ?? 0}
                        </span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm">
                        <ChevronRight className="h-4 w-4" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative flex flex-col p-6 bg-card border border-border rounded-[32px] cursor-pointer transition-all duration-500 hover:border-primary/50 hover:bg-accent/10 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:-translate-y-1 active:scale-[0.98]",
                className
            )}
        >
            <div className="flex items-start justify-between mb-5">
                <Avatar className="h-14 w-14 rounded-2xl bg-muted text-foreground shadow-xl group-hover:scale-110 transition-transform duration-700 ease-out border border-border overflow-hidden">
                    {avatar ? (
                        <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 font-black text-xl tracking-tighter w-full h-full flex items-center justify-center text-white">
                            {displayName.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                    )}
                </Avatar>

                <div className="p-2.5 rounded-2xl bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-inner">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>

            <div className="flex-1 space-y-2.5">
                <h4 className="font-black text-lg text-foreground tracking-tight truncate group-hover:text-primary transition-all duration-300">
                    {displayName}
                </h4>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                    <div className="p-1 rounded-sm bg-primary/10">
                        <Globe className="h-3 w-3 text-primary" />
                    </div>
                    <span className="truncate">{relayHost}</span>
                </div>
            </div>

            <div className="mt-5 pt-5 border-t border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full border border-border/50 backdrop-blur-sm">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] font-black text-muted-foreground">
                        {memberCount ?? 0}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                    <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">
                        Active
                    </span>
                </div>
            </div>
        </div>
    );
};
