"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { cn } from "@/app/lib/utils";
import { formatTime, highlightText } from "../utils/formatting";
import type { Conversation, RequestsInboxItem } from "../types";
import { RequestsInboxPanel } from "./requests-inbox-panel";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { SidebarUserSearch } from "./sidebar-user-search";

export interface SidebarProps {
    isNewChatOpen: boolean;
    setIsNewChatOpen: (val: boolean) => void;
    isNewGroupOpen: boolean;
    setIsNewGroupOpen: (val: boolean) => void;
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    hasHydrated: boolean;
    filteredConversations: ReadonlyArray<Conversation>;
    selectConversation: (conversation: Conversation) => void;
    selectedConversation: Conversation | null;
    unreadByConversationId: Record<string, number>;
    nowMs: number | null;
    messageSearchResults: ReadonlyArray<{ conversationId: string; messageId: string; timestamp: Date; preview: string }>;
    allConversations: ReadonlyArray<Conversation>;
    setPendingScrollTarget: (target: { conversationId: string; messageId: string } | null) => void;

    // Requests Inbox Props
    activeTab: "chats" | "requests";
    setActiveTab: (tab: "chats" | "requests") => void;
    requests: ReadonlyArray<RequestsInboxItem>;
    onAcceptRequest: (pubkey: PublicKeyHex) => void;
    onIgnoreRequest: (pubkey: PublicKeyHex) => void;
    onBlockRequest: (pubkey: PublicKeyHex) => void;
    onSelectRequest: (pubkey: PublicKeyHex) => void;
}

export function Sidebar({
    setIsNewChatOpen,
    setIsNewGroupOpen,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    hasHydrated,
    filteredConversations,
    selectConversation,
    selectedConversation,
    unreadByConversationId,
    nowMs,
    messageSearchResults,
    allConversations,
    setPendingScrollTarget,
    activeTab,
    setActiveTab,
    requests,
    onAcceptRequest,
    onIgnoreRequest,
    onBlockRequest,
    onSelectRequest
}: SidebarProps) {
    const { t } = useTranslation();
    const [initialNowMs] = useState<number>(() => Date.now());
    const resolvedNowMs: number = nowMs ?? initialNowMs;

    const chatsUnreadTotal = Object.values(unreadByConversationId).reduce((a: number, b: number) => a + b, 0);
    const requestsUnreadTotal = requests.reduce((sum: number, r: RequestsInboxItem) => sum + r.unreadCount, 0);

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-black/[0.03] p-4 dark:border-white/[0.03] space-y-4">
                <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl ring-1 ring-black/5 dark:ring-white/5 relative">
                    <button
                        onClick={() => setActiveTab("chats")}
                        suppressHydrationWarning
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-bold rounded-lg transition-all z-10",
                            activeTab === "chats"
                                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        {t("nav.chats")}
                        {chatsUnreadTotal > 0 && (
                            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-purple-600 px-1 text-[9px] text-white shadow-sm">
                                {chatsUnreadTotal}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("requests")}
                        suppressHydrationWarning
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-bold rounded-lg transition-all z-10",
                            activeTab === "requests"
                                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                    >
                        {t("nav.requests")}
                        {requests.length > 0 && (
                            <span className={cn(
                                "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] text-white shadow-sm",
                                requestsUnreadTotal > 0 ? "bg-rose-500" : "bg-zinc-400 dark:bg-zinc-600"
                            )}>
                                {requestsUnreadTotal > 0 ? requestsUnreadTotal : requests.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="space-y-3">
                    <SidebarUserSearch onUserSelect={(user) => {
                        // Trigger new chat with selected global user
                        setIsNewChatOpen(true);
                        // We might want to pre-fill the new chat dialog or directly call it
                    }} />

                    <div className="relative group">
                        <Input
                            ref={searchInputRef}
                            placeholder={t("messaging.searchChats")}
                            className="pl-9 h-11 bg-black/[0.02] dark:bg-white/[0.02] border-transparent focus-visible:bg-white dark:focus-visible:bg-zinc-900 transition-all rounded-2xl"
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            suppressHydrationWarning
                        />
                        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 transition-colors group-focus-within:text-purple-500">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                </div>

                {activeTab === "chats" && (
                    <div className="flex gap-3">
                        <Button type="button" className="flex-1 h-10 shadow-sm py-0 rounded-2xl" onClick={() => setIsNewChatOpen(true)} suppressHydrationWarning>
                            <span className="text-xs font-bold tracking-tight">{t("messaging.newChat")}</span>
                        </Button>
                        <Button type="button" variant="secondary" className="flex-1 h-10 border-black/[0.03] dark:border-white/[0.03] py-0 rounded-2xl" onClick={() => setIsNewGroupOpen(true)} suppressHydrationWarning>
                            <span className="text-xs font-bold tracking-tight">{t("messaging.newGroup")}</span>
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === "requests" ? (
                    <RequestsInboxPanel
                        requests={requests}
                        nowMs={resolvedNowMs}
                        onAccept={onAcceptRequest}
                        onIgnore={onIgnoreRequest}
                        onBlock={onBlockRequest}
                        onSelect={onSelectRequest}
                        onFindSomeone={() => setIsNewChatOpen(true)}
                    />
                ) : (
                    <>
                        {!hasHydrated ? (
                            <div className="space-y-2 p-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-start gap-4 p-3 h-20">
                                        <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                                        <div className="flex-1 space-y-3 py-1">
                                            <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                                            <div className="h-3 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {filteredConversations.map((conversation) => (
                                    <button
                                        key={conversation.id}
                                        onClick={() => selectConversation(conversation)}
                                        className={cn(
                                            "flex w-full items-start gap-3 border-b border-black/5 p-3 text-left transition-all hover:bg-zinc-50/80 dark:border-white/5 dark:hover:bg-zinc-900/40",
                                            selectedConversation?.id === conversation.id && "bg-zinc-100/50 dark:bg-zinc-900/60"
                                        )}
                                    >
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-black text-sm font-black text-white dark:from-zinc-100 dark:to-zinc-300 dark:text-black shadow-sm">
                                            {conversation.displayName[0]}
                                        </div>

                                        <div className="min-w-0 flex-1 py-0.5">
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">{conversation.displayName}</span>
                                                {formatTime(conversation.lastMessageTime, resolvedNowMs) ? (
                                                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{formatTime(conversation.lastMessageTime, resolvedNowMs)}</span>
                                                ) : null}
                                            </div>
                                            <div className="flex items-start justify-between gap-2 overflow-hidden">
                                                <p className="truncate text-xs text-zinc-600 dark:text-zinc-400 leading-normal flex-1">
                                                    {conversation.lastMessage || t("messaging.noMessagesYet")}
                                                </p>
                                                {(unreadByConversationId[conversation.id] ?? conversation.unreadCount) > 0 ? (
                                                    <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1.5 text-[10px] font-black text-white shadow-sm ring-2 ring-white dark:ring-black">
                                                        {unreadByConversationId[conversation.id] ?? conversation.unreadCount}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </button>
                                ))}

                                {searchQuery.trim().length > 0 && (
                                    <div className="p-3">
                                        <div className="mb-3 px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("messaging.messageResults")}</div>
                                        {messageSearchResults.length === 0 ? (
                                            <div className="py-4">
                                                <p className="text-center text-xs text-zinc-500">{t("messaging.noMatchingMessages")}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {messageSearchResults.map((result) => {
                                                    const conversation = allConversations.find((c) => c.id === result.conversationId);
                                                    if (!conversation) return null;
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
                                                                <div className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">{conversation.displayName}</div>
                                                                <div className="shrink-0 text-[10px] font-medium text-zinc-500">{formatTime(result.timestamp, resolvedNowMs) ?? ""}</div>
                                                            </div>
                                                            <div className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400 italic">
                                                                &quot;{highlightText({ text: result.preview, query: searchQuery })}&quot;
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
