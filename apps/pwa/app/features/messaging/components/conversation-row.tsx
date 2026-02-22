"use client";

import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { cn } from "@/app/lib/utils";
import { formatTime } from "../utils/formatting";
import type { Conversation } from "../types";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";
import { MoreVertical, Pin, PinOff, Trash2 } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

export interface ConversationRowProps {
    conversation: Conversation;
    isSelected: boolean;
    onSelect: (conversation: Conversation) => void;
    unreadCount: number;
    nowMs: number;
    isPinned?: boolean;
    onTogglePin?: () => void;
    onHide?: () => void;
}

export function ConversationRow({
    conversation,
    isSelected,
    onSelect,
    unreadCount,
    nowMs,
    isPinned,
    onTogglePin,
    onHide
}: ConversationRowProps) {
    const { t } = useTranslation();
    const metadata = useProfileMetadata(conversation.kind === "dm" ? conversation.pubkey : null);
    const resolvedName = metadata?.displayName || conversation.displayName;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(conversation)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(conversation);
                }
            }}
            className={cn(
                "flex w-full items-start gap-3 border-b border-black/5 p-3 text-left transition-all hover:bg-zinc-50/80 dark:border-white/5 dark:hover:bg-zinc-900/40 group cursor-pointer outline-none focus-visible:bg-zinc-50/80 dark:focus-visible:bg-zinc-900/40",
                isSelected && "bg-zinc-100/50 dark:bg-zinc-900/60"
            )}
        >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-black text-sm font-black text-white dark:from-zinc-100 dark:to-zinc-300 dark:text-black shadow-sm overflow-hidden">
                {metadata?.avatarUrl ? (
                    <Image src={metadata.avatarUrl} alt={resolvedName} width={48} height={48} className="h-full w-full object-cover" unoptimized />
                ) : (
                    resolvedName[0]?.toUpperCase()
                )}
            </div>

            <div className="min-w-0 flex-1 py-0.5">
                <div className="mb-1 flex items-center justify-between">
                    <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 truncate pr-2">
                        {resolvedName}
                    </span>
                    {formatTime(conversation.lastMessageTime, nowMs) ? (
                        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                            {formatTime(conversation.lastMessageTime, nowMs)}
                        </span>
                    ) : null}
                </div>
                <div className="flex items-start justify-between gap-1 overflow-hidden">
                    {isPinned && (
                        <Pin className="h-3 w-3 shrink-0 text-purple-500 fill-purple-500/20 rotate-45 mr-1" />
                    )}
                    <p className="truncate text-xs text-zinc-600 dark:text-zinc-400 leading-normal flex-1 font-medium">
                        {conversation.lastMessage || t("messaging.noMessagesYet")}
                    </p>
                    {unreadCount > 0 ? (
                        <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white shadow-sm ring-2 ring-white dark:ring-black">
                            {unreadCount}
                        </span>
                    ) : null}

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-opacity">
                                <MoreVertical className="h-3 w-3 text-zinc-400" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}>
                                {isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
                                {isPinned ? t("messaging.unpin_chat") : t("messaging.pin_chat")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={(e) => { e.stopPropagation(); onHide?.(); }}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("messaging.delete_chat")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
