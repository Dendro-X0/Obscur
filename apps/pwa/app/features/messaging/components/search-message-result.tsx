"use client";

import React from "react";
import { formatTime, highlightText } from "../utils/formatting";
import type { Conversation } from "../types";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";

export interface SearchMessageResultProps {
    result: { conversationId: string; messageId: string; timestamp: Date; preview: string };
    conversation: Conversation;
    selectConversation: (conversation: Conversation) => void;
    setPendingScrollTarget: (target: { conversationId: string; messageId: string } | null) => void;
    searchQuery: string;
    resolvedNowMs: number;
}

export function SearchMessageResult({
    result,
    conversation,
    selectConversation,
    setPendingScrollTarget,
    searchQuery,
    resolvedNowMs
}: SearchMessageResultProps) {
    const metadata = useProfileMetadata(conversation.kind === "dm" ? conversation.pubkey : null);
    const resolvedName = metadata?.displayName || conversation.displayName;

    return (
        <button
            key={`${result.conversationId}-${result.messageId}`}
            type="button"
            className="w-full rounded-xl border border-black/5 bg-white p-3 text-left hover:border-purple-500/30 dark:border-white/5 dark:bg-zinc-900/50 transition-all shadow-sm"
            onClick={() => {
                selectConversation(conversation);
                setPendingScrollTarget({ conversationId: result.conversationId, messageId: result.messageId });
            }}
        >
            <div className="flex items-center justify-between gap-2 mb-1">
                <div className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">{resolvedName}</div>
                <div className="shrink-0 text-[10px] font-medium text-zinc-500">
                    {formatTime(result.timestamp, resolvedNowMs) ?? ""}
                </div>
            </div>
            <div className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400 italic">
                &quot;{highlightText({ text: result.preview, query: searchQuery })}&quot;
            </div>
        </button>
    );
}
