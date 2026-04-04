"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui/button";
import { cn } from "@/app/lib/utils";
import type { Conversation, RequestsInboxItem } from "../types";
import { formatTime } from "../utils/formatting";
import { RequestsInboxPanel } from "./requests-inbox-panel";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { SidebarUserSearch } from "./sidebar-user-search";
import { ConversationRow } from "./conversation-row";
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
import { RelayStatusIndicator } from "../../relays/components/relay-status-indicator";
import { getIncomingPendingRequestCount, getIncomingUnreadRequestTotal } from "../services/request-inbox-view";
import { getPublicProfileHref } from "@/app/features/navigation/public-routes";

const INITIAL_SIDEBAR_PAGE_SIZE = 25;
const SIDEBAR_PAGE_STEP = 25;
const SIDEBAR_MAX_ITEMS = 50;

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
    interactionByConversationId?: Readonly<Record<string, Readonly<{ lastActiveAtMs?: number; lastViewedAtMs?: number }>>>;
    nowMs: number | null;

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
    hideConversation: (conversationId: string) => void;
    clearHistory: (conversationId: string) => void;
    onClearHistory: () => void;
    isPeerOnline?: (publicKeyHex: PublicKeyHex) => boolean;
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
    interactionByConversationId,
    nowMs,
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
    hideConversation,
    onClearHistory
    , isPeerOnline
}: SidebarProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const resolvedNowMs = nowMs;

    const hiddenChatIdSet = React.useMemo(() => new Set(hiddenChatIds), [hiddenChatIds]);
    const pinnedChatIdSet = React.useMemo(() => new Set(pinnedChatIds), [pinnedChatIds]);

    const conversationBuckets = React.useMemo(() => {
        const unreadByConversationIdResolved: Record<string, number> = {};
        const pinnedConversationsResult: Conversation[] = [];
        const directConversationsResult: Conversation[] = [];
        const communityConversationsResult: Conversation[] = [];
        let chatsUnreadTotalResult = 0;
        let dmsUnreadResult = 0;
        let groupsUnreadResult = 0;
        for (const conversation of filteredConversations) {
            if (conversation.kind === "dm" && hiddenChatIdSet.has(conversation.id)) {
                continue;
            }
            const unread = selectedConversation?.id === conversation.id
                ? 0
                : (unreadByConversationId[conversation.id] ?? conversation.unreadCount);
            unreadByConversationIdResolved[conversation.id] = unread;
            chatsUnreadTotalResult += unread;
            if (conversation.kind === "dm") {
                dmsUnreadResult += unread;
            } else {
                groupsUnreadResult += unread;
            }
            if (pinnedChatIdSet.has(conversation.id)) {
                pinnedConversationsResult.push(conversation);
                continue;
            }
            if (conversation.kind === "dm") {
                directConversationsResult.push(conversation);
            } else {
                communityConversationsResult.push(conversation);
            }
        }
        return {
            unreadByConversationIdResolved,
            chatsUnreadTotal: chatsUnreadTotalResult,
            dmsUnread: dmsUnreadResult,
            groupsUnread: groupsUnreadResult,
            pinnedConversations: pinnedConversationsResult,
            cappedDms: directConversationsResult.slice(0, SIDEBAR_MAX_ITEMS),
            cappedCommunities: communityConversationsResult.slice(0, SIDEBAR_MAX_ITEMS),
        };
    }, [filteredConversations, hiddenChatIdSet, pinnedChatIdSet, selectedConversation?.id, unreadByConversationId]);

    const resolveConversationUnread = React.useCallback((conversation: Conversation): number => {
        return conversationBuckets.unreadByConversationIdResolved[conversation.id] ?? 0;
    }, [conversationBuckets.unreadByConversationIdResolved]);

    const chatsUnreadTotal = conversationBuckets.chatsUnreadTotal;
    const requestsUnreadTotal = getIncomingUnreadRequestTotal(requests);
    const pendingRequestsCount = getIncomingPendingRequestCount(requests);

    const [isDmsExpanded, setIsDmsExpanded] = useState(true);
    const [isCommunitiesExpanded, setIsCommunitiesExpanded] = useState(true);
    const [chatViewMode, setChatViewMode] = useState<"direct" | "community">("direct");
    const [visibleDmCount, setVisibleDmCount] = useState<number>(INITIAL_SIDEBAR_PAGE_SIZE);
    const [visibleCommunityCount, setVisibleCommunityCount] = useState<number>(INITIAL_SIDEBAR_PAGE_SIZE);
    const searchDismissSignal = `${activeTab}:${chatViewMode}:${selectedConversation?.id ?? ""}`;
    const areChatSectionsExpanded = isDmsExpanded && isCommunitiesExpanded;

    React.useEffect(() => {
        if (selectedConversation?.kind === "group") {
            setChatViewMode("community");
            setIsCommunitiesExpanded(true);
        }
    }, [selectedConversation?.id, selectedConversation?.kind]);

    React.useEffect(() => {
        setVisibleDmCount(INITIAL_SIDEBAR_PAGE_SIZE);
        setVisibleCommunityCount(INITIAL_SIDEBAR_PAGE_SIZE);
    }, [activeTab, chatViewMode, searchQuery]);


    const pinnedConversations = conversationBuckets.pinnedConversations;
    const cappedDms = conversationBuckets.cappedDms;
    const cappedCommunities = conversationBuckets.cappedCommunities;
    const visibleDms = cappedDms.slice(0, visibleDmCount);
    const visibleCommunities = cappedCommunities.slice(0, visibleCommunityCount);
    const canLoadMoreDms = visibleDms.length < cappedDms.length;
    const canLoadMoreCommunities = visibleCommunities.length < cappedCommunities.length;

    const dmsUnread = conversationBuckets.dmsUnread;
    const groupsUnread = conversationBuckets.groupsUnread;

    const renderConversationList = React.useCallback((list: ReadonlyArray<Conversation>) => (
        list.map((conversation) => {
            const interaction = interactionByConversationId?.[conversation.id];
            return (
                <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    isSelected={selectedConversation?.id === conversation.id}
                    onSelect={selectConversation}
                    unreadCount={resolveConversationUnread(conversation)}
                    isOnline={conversation.kind === "dm" ? Boolean(isPeerOnline?.(conversation.pubkey as PublicKeyHex)) : undefined}
                    lastMessageLabel={formatTime(conversation.lastMessageTime, resolvedNowMs)}
                    lastActiveLabel={conversation.kind === "dm" && interaction?.lastActiveAtMs
                        ? formatTime(new Date(interaction.lastActiveAtMs), resolvedNowMs)
                        : ""}
                    lastViewedLabel={conversation.kind === "dm" && interaction?.lastViewedAtMs
                        ? formatTime(new Date(interaction.lastViewedAtMs), resolvedNowMs)
                        : ""}
                    isPinned={pinnedChatIdSet.has(conversation.id)}
                    onTogglePin={togglePin}
                    onHide={hideConversation}
                    onViewProfile={(pubkey) => {
                        void router.push(getPublicProfileHref(pubkey));
                    }}
                />
            );
        })
    ), [hideConversation, interactionByConversationId, pinnedChatIdSet, resolvedNowMs, resolveConversationUnread, router, selectConversation, selectedConversation?.id, togglePin, isPeerOnline]);
    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-black/[0.03] p-4 dark:border-white/[0.03] space-y-4">
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-xl text-zinc-500"
                                aria-label={t("messaging.sidebar_options", "Sidebar Options")}
                                title={t("messaging.sidebar_options", "Sidebar Options")}
                            >
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="z-[10040] w-48">
                            {activeTab === "chats" ? (
                                <>
                                    <DropdownMenuItem
                                        className="gap-2"
                                        onClick={() => {
                                            const nextExpanded = !areChatSectionsExpanded;
                                            setIsDmsExpanded(nextExpanded);
                                            setIsCommunitiesExpanded(nextExpanded);
                                        }}
                                    >
                                        {areChatSectionsExpanded
                                            ? <ChevronDown className="h-4 w-4" />
                                            : <ChevronRight className="h-4 w-4" />}
                                        <span>{areChatSectionsExpanded
                                            ? t("messaging.collapse_sections", "Collapse Sections")
                                            : t("messaging.expand_sections", "Expand Sections")}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="gap-2"
                                        onClick={() => setChatViewMode(chatViewMode === "direct" ? "community" : "direct")}
                                    >
                                        {chatViewMode === "direct"
                                            ? <Users className="h-4 w-4" />
                                            : <User className="h-4 w-4" />}
                                        <span>{chatViewMode === "direct"
                                            ? t("messaging.show_communities", "Show Communities")
                                            : t("messaging.show_direct_messages", "Show Direct Messages")}</span>
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                <DropdownMenuItem
                                    className="gap-2 text-red-600 focus:text-red-600"
                                    onClick={onClearHistory}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>{t("messaging.clear_history", "Clear History")}</span>
                                </DropdownMenuItem>
                            )}
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
                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] text-white shadow-sm">
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
                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] text-white shadow-sm">
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
                    <SidebarUserSearch
                        query={searchQuery}
                        onQueryChange={setSearchQuery}
                        inputRef={searchInputRef}
                        dismissSignal={searchDismissSignal}
                        onUserSelect={(user) => {
                        // Trigger new chat with selected global user
                        setIsNewChatOpen(true);
                        // We might want to pre-fill the new chat dialog or directly call it
                    }}
                    />
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
                                {dmsUnread > 0 && (
                                    <span className="ml-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] text-white shadow-sm">
                                        {dmsUnread}
                                    </span>
                                )}
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
                                {groupsUnread > 0 && (
                                    <span className="ml-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] text-white shadow-sm">
                                        {groupsUnread}
                                    </span>
                                )}
                            </button>
                        </div>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-xl border-black/[0.03] dark:border-white/[0.03]"
                            onClick={() => chatViewMode === "direct" ? setIsNewChatOpen(true) : setIsNewGroupOpen(true)}
                            aria-label={chatViewMode === "direct"
                                ? t("messaging.new_chat", "New Chat")
                                : t("messaging.new_group", "New Group")}
                            title={chatViewMode === "direct"
                                ? t("messaging.new_chat", "New Chat")
                                : t("messaging.new_group", "New Group")}
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
                                    <div className="animate-in fade-in slide-in-from-right-1 duration-200">
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
                                        {isDmsExpanded && (
                                            <>
                                                {renderConversationList(visibleDms)}
                                                {canLoadMoreDms ? (
                                                    <div className="px-4 py-3">
                                                        <Button
                                                            variant="ghost"
                                                            className="h-9 w-full rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                                                            onClick={() => setVisibleDmCount((count) => Math.min(count + SIDEBAR_PAGE_STEP, SIDEBAR_MAX_ITEMS))}
                                                            data-testid="sidebar-load-more-dms"
                                                        >
                                                            {t("common.loadMore", "Load More")}
                                                        </Button>
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                )}

                                {chatViewMode === "community" && (
                                    <div className="mt-4 animate-in fade-in slide-in-from-right-1 duration-200">
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
                                        {isCommunitiesExpanded && (
                                            <>
                                                {renderConversationList(visibleCommunities)}
                                                {canLoadMoreCommunities ? (
                                                    <div className="px-4 py-3">
                                                        <Button
                                                            variant="ghost"
                                                            className="h-9 w-full rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                                                            onClick={() => setVisibleCommunityCount((count) => Math.min(count + SIDEBAR_PAGE_STEP, SIDEBAR_MAX_ITEMS))}
                                                            data-testid="sidebar-load-more-communities"
                                                        >
                                                            {t("common.loadMore", "Load More")}
                                                        </Button>
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                )}

                            </>
                        )}
                    </>
                )}
            </div>
            <div className="border-t border-black/[0.03] dark:border-white/[0.03] mt-auto">
                <RelayStatusIndicator />
            </div>
        </div>
    );
}
