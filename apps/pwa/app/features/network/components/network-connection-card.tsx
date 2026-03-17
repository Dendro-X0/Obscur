"use client";

import React from "react";
import { UserAvatar } from "../../profile/components/user-avatar";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";
import { useResolvedProfileMetadata } from "../../profile/hooks/use-resolved-profile-metadata";

interface ConnectionCardProps {
    pubkey: string;
    displayName?: string;
    onClick: () => void;
    className?: string;
    viewMode?: "list" | "grid";
}

export const ConnectionCard = ({ pubkey, displayName, onClick, className, viewMode = "list" }: ConnectionCardProps) => {
    const { t } = useTranslation();
    const metadata = useResolvedProfileMetadata(pubkey);
    const resolvedName = metadata?.displayName || displayName;
    const handle = resolvedName ? `@${resolvedName}` : `@${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;

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
                    <div className="relative">
                        <UserAvatar
                            pubkey={pubkey}
                            size="lg"
                            showProfileOnClick={false}
                            className="bg-muted border border-border"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-sm text-foreground truncate">
                                {resolvedName || "Unknown"}
                            </h4>
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground font-mono truncate">
                            {pubkey.slice(0, 16)}...{pubkey.slice(-8)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {t("network.trusted", "Trusted")}
                    </span>
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
                "group relative flex flex-col items-center p-6 bg-card/40 backdrop-blur-xl border border-border rounded-[32px] cursor-pointer transition-all duration-300 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 active:scale-[0.98]",
                className
            )}
        >
            <div className="relative mb-4">
                <UserAvatar
                    pubkey={pubkey}
                    size="xl"
                    showProfileOnClick={false}
                    className="ring-4 ring-background shadow-xl group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-4 border-background shadow-sm" />
            </div>

            <div className="text-center w-full space-y-1 mb-4">
                <div className="flex items-center justify-center gap-1.5">
                    <h4 className="font-black text-base text-foreground truncate max-w-[140px]">
                        {handle}
                    </h4>
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-full px-4">
                    {pubkey}
                </p>
            </div>

            <div className="flex items-center justify-center gap-2 w-full pt-2 border-t border-border/10">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-500/10 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-500/10">
                    {t("network.trusted", "Trusted")}
                </span>
            </div>

            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
};
