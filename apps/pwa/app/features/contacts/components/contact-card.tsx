"use client";

import React from "react";
import { UserAvatar } from "../../profile/components/user-avatar";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/app/lib/cn";
import { useTranslation } from "react-i18next";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";

interface ContactCardProps {
    pubkey: string;
    displayName?: string;
    onClick: () => void;
    className?: string;
}

export const ContactCard = ({ pubkey, displayName, onClick, className }: ContactCardProps) => {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(pubkey);
    const resolvedName = metadata?.displayName || displayName;
    const handle = resolvedName ? `@${resolvedName}` : `@${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative flex flex-col items-center p-6 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-zinc-200/50 dark:border-white/5 rounded-[32px] cursor-pointer transition-all duration-300 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 active:scale-[0.98]",
                className
            )}
        >
            <div className="relative mb-4">
                <UserAvatar
                    pubkey={pubkey}
                    size="xl"
                    showProfileOnClick={false}
                    className="ring-4 ring-white dark:ring-zinc-950 shadow-xl group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-4 border-white dark:border-zinc-900 shadow-sm" />
            </div>

            <div className="text-center w-full space-y-1 mb-4">
                <div className="flex items-center justify-center gap-1.5">
                    <h4 className="font-black text-base text-zinc-900 dark:text-zinc-50 truncate max-w-[140px]">
                        {handle}
                    </h4>
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-[10px] text-zinc-400 font-mono truncate max-w-full px-4">
                    {pubkey}
                </p>
            </div>

            <div className="flex items-center justify-center gap-2 w-full pt-2 border-t border-black/[0.03] dark:border-white/[0.03]">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-500/10">
                    {t("contacts.trusted", "Trusted")}
                </span>
            </div>

            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="p-2 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-500/40">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
};
