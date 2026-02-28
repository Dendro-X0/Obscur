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
import { ConversationRow } from "./conversation-row";
import { SearchMessageResult } from "./search-message-result";
import { useProfileMetadata } from "../../profile/hooks/use-profile-metadata";
import {
    MoreVertical, Pin, Trash2, Users, User,
    ChevronDown, ChevronRight, Plus
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

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

    // Pin/Hide actions
    pinnedChatIds: ReadonlyArray<string>;
    togglePin: (conversationId: string) => void;
    hiddenChatIds: ReadonlyArray<string>;
    deleteConversation: (conversationId: string) => void;
    clearHistory: (conversationId: string) => void;
    onClearHistory: () => void;
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
    onSelectRequest,
    pinnedChatIds,
    togglePin,
    hiddenChatIds,
    deleteConversation,
    clearHistory,
    onClearHistory
}: SidebarProps) {
    const { t } = useTranslation();
    const [localNowMs, setLocalNowMs] = React.useState<number>(() => Date.now());

    React.useEffect(() => {
        const interval = setInterval(() => setLocalNowMs(Date.now()), 30000); // 30s update
        return () => clearInterval(interval);
    }, []);

    const resolvedNowMs: number = nowMs ?? localNowMs;

    const chatsUnreadTotal = Object.values(unreadByConversationId).reduce((a: number, b: number) => a + b, 0);
    const requestsUnreadTotal = requests.reduce((sum: number, r: RequestsInboxItem) => sum + r.unreadCount, 0);
    const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

    const [isDmsExpanded, setIsDmsExpanded] = useState(true);
    const [isCommunitiesExpanded, setIsCommunitiesExpanded] = useState(true);
    const [chatViewMode, setChatViewMode] = useState<"direct" | "community">("direct");

    const visibleConversations = filteredConversations.filter(c => !hiddenChatIds.includes(c.id));

    const pinnedConversations = visibleConversations.filter(c => pinnedChatIds.includes(c.id));
    const unpinnedConversations = visibleConversations.filter(c => !pinnedChatIds.includes(c.id));

    const dms = unpinnedConversations.filter(c => c.kind === 'dm');
    const communities = unpinnedConversations.filter(c => c.kind === 'group');

    const renderConversationList = (list: ReadonlyArray<Conversation>) => (
        list.map((conversation) => (
            <ConversationRow
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                onSelect={selectConversation}
                unreadCount={unreadByConversationId[conversation.id] ?? conversation.unreadCount}
                nowMs={resolvedNowMs}
                isPinned={pinnedChatIds.includes(conversation.id)}
                onTogglePin={() => togglePin(conversation.id)}
                onDelete={() => clearHistory(conversation.id)}
                onHide={() => deleteConversation(conversation.id)}
            />
        ))
    );
    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-black/[0.03] p-4 dark:border-white/[0.03] space-y-4">
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-zinc-500">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem className="gap-2">
                                <Pin className="h-4 w-4" />
                                <span>{t("messaging.pin_chat")}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="gap-2 text-red-600 focus:text-red-600"
                                onClick={() => selectedConversation && clearHistory(selectedConversation.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                                <span>{t("messaging.delete_chat")}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex-1 flex p-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-xl ring-1 ring-black/5 dark:ring-white/5 relative">
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
                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] text-white shadow-sm">
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
                            {requestsUnreadTotal > 0 ? (
                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] text-white shadow-sm">
                                    {requestsUnreadTotal}
                                </span>
                            ) : pendingRequestsCount > 0 && (
                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-400 dark:bg-zinc-600 px-1 text-[9px] text-white shadow-sm">
                                    {pendingRequestsCount}
                                </span>
                            )}
                        </button>
                    </div>
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
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                </div>

                {activeTab === "chats" && (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex p-1 bg-black/[0.03] dark:bg-white/[0.03] rounded-xl ring-1 ring-black/5 dark:ring-white/5 relative">
                            <button
                                onClick={() => setChatViewMode("direct")}
                                className={cn(
                                    "flex-1 flex items-center justify-center py-2 text-[11px] font-bold rounded-lg transition-all z-10",
                                    chatViewMode === "direct"
                                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                {t("messaging.chat")}
                            </button>
                            <button
                                onClick={() => setChatViewMode("community")}
                                className={cn(
                                    "flex-1 flex items-center justify-center py-2 text-[11px] font-bold rounded-lg transition-all z-10",
                                    chatViewMode === "community"
                                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                            >
                                {t("messaging.group")}
                            </button>
                        </div>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-xl border-black/[0.03] dark:border-white/[0.03]"
                            onClick={() => chatViewMode === "direct" ? setIsNewChatOpen(true) : setIsNewGroupOpen(true)}
                        >
                            <Plus className="h-5 w-5" />
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
                        onClearHistory={onClearHistory}
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
                                {pinnedConversations.length > 0 && (
                                    <div className="mb-4">
                                        <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                            <Pin className="h-3 w-3" />
                                            {t("messaging.pinned")}
                                        </div>
                                        {renderConversationList(pinnedConversations)}
                                    </div>
                                )}

                                {chatViewMode === "direct" && (
                                    <div>
                                        <button
                                            onClick={() => setIsDmsExpanded(!isDmsExpanded)}
                                            className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <User className="h-3 w-3" />
                                                {t("messaging.direct_messages")}
                                            </div>
                                            {isDmsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </button>
                                        {isDmsExpanded && renderConversationList(dms)}
                                    </div>
                                )}

                                {chatViewMode === "community" && (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => setIsCommunitiesExpanded(!isCommunitiesExpanded)}
                                            className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Users className="h-3 w-3" />
                                                {t("messaging.communities")}
                                            </div>
                                            {isCommunitiesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </button>
                                        {isCommunitiesExpanded && renderConversationList(communities)}
                                    </div>
                                )}

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
                                                        <SearchMessageResult
                                                            key={`${result.conversationId}-${result.messageId}`}
                                                            result={result}
                                                            conversation={conversation}
                                                            selectConversation={selectConversation}
                                                            setPendingScrollTarget={setPendingScrollTarget}
                                                            searchQuery={searchQuery}
                                                            resolvedNowMs={resolvedNowMs}
                                                        />
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
