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
    online?: boolean;
    onClick: () => void;
    className?: string;
    viewMode?: "list" | "grid";
}

export const ConnectionCard = ({ pubkey, displayName, online = false, onClick, className, viewMode = "list" }: ConnectionCardProps) => {
    const { t } = useTranslation();
    const metadata = useResolvedProfileMetadata(pubkey);
    const resolvedName = metadata?.displayName || displayName;
    const handle = resolvedName ?? `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
    const statusLabel = online ? t("network.online", "Online") : t("network.offline", "Offline");
    const statusTone = online
        ? "bg-emerald-500 text-emerald-50 border-emerald-300/50"
        : "bg-zinc-500 text-zinc-100 border-zinc-300/50 dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-500/50";

    if (viewMode === "list") {
        return (
            <div
                onClick={onClick}
                className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-xl border border-transparent px-3 py-3 transition-all hover:border-border/70 hover:bg-card/70",
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
                        <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                            online ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
                        )} />
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
                    <span className={cn(
                        "hidden rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest sm:inline-block",
                        statusTone
                    )}>
                        {statusLabel}
                    </span>
                    <span className="hidden rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500 sm:inline-block">
                        {t("network.trusted", "Trusted")}
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm transition-all group-hover:bg-emerald-500 group-hover:text-white">
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
                "group relative flex cursor-pointer flex-col items-center rounded-[28px] border border-border/70 bg-card/65 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/35 hover:shadow-2xl hover:shadow-emerald-950/10 active:scale-[0.98]",
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
                <div className={cn(
                    "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-background shadow-sm",
                    online ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
                )} />
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

            <div className="flex w-full items-center justify-center gap-2 border-t border-border/20 pt-2">
                <span className={cn(
                    "rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest",
                    statusTone
                )}>
                    {statusLabel}
                </span>
                <span className="rounded-full border border-emerald-500/15 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                    {t("network.trusted", "Trusted")}
                </span>
            </div>

            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="rounded-full bg-emerald-500 p-2 text-white shadow-lg shadow-emerald-900/30">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
};
