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
import { ConversationRow } from "./conversation-row";
import { Pin, Users, User, ChevronDown, ChevronRight, } from "lucide-react";
import { getIncomingPendingRequestCount, getIncomingUnreadRequestTotal, getOpenPendingRequestCount } from "../services/request-inbox-view";
import type { MessagingSidebarTab } from "../services/messaging-sidebar-tab";
import { getPublicProfileHref } from "@/app/features/navigation/public-routes";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";
import { SidebarListChrome } from "./sidebar-list-chrome";
import { resolveConversationUnreadCount } from "../providers/unread-last-seen-suppression";
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
    lastViewedByConversationId?: Readonly<Record<string, number>>;
    interactionByConversationId?: Readonly<Record<string, Readonly<{
        lastActiveAtMs?: number;
        lastViewedAtMs?: number;
    }>>>;
    nowMs: number | null;
    // Requests Inbox Props
    activeTab: MessagingSidebarTab;
    setActiveTab: (tab: MessagingSidebarTab) => void;
    requests: ReadonlyArray<RequestsInboxItem>;
    junkRequests: ReadonlyArray<RequestsInboxItem>;
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
    pendingRequestsCount?: number;
    isPeerOnline?: (publicKeyHex: PublicKeyHex) => boolean;
    showHistorySyncNotice?: boolean;
    pendingRequestsBadgeDismissed?: boolean;
    onDismissPendingRequestsBadge?: () => void;
}
export function Sidebar({ setIsNewChatOpen, setIsNewGroupOpen, searchQuery, setSearchQuery, searchInputRef, hasHydrated, filteredConversations, selectConversation, selectedConversation, unreadByConversationId, lastViewedByConversationId, interactionByConversationId, nowMs, activeTab, setActiveTab, requests, junkRequests, onAcceptRequest, onIgnoreRequest, onBlockRequest, onSelectRequest, pinnedChatIds, togglePin, hiddenChatIds, hideConversation, onClearHistory, isPeerOnline, showHistorySyncNotice = false, pendingRequestsBadgeDismissed = false, onDismissPendingRequestsBadge, pendingRequestsCount: pendingRequestsCountProp, }: SidebarProps) {
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
            const unread = resolveConversationUnreadCount({
                conversation,
                unreadByConversationId,
                lastSeenByConversationId: lastViewedByConversationId,
                selectedConversationId: selectedConversation?.id ?? null,
            });
            unreadByConversationIdResolved[conversation.id] = unread;
            chatsUnreadTotalResult += unread;
            if (conversation.kind === "dm") {
                dmsUnreadResult += unread;
            }
            else {
                groupsUnreadResult += unread;
            }
            if (pinnedChatIdSet.has(conversation.id)) {
                pinnedConversationsResult.push(conversation);
                continue;
            }
            if (conversation.kind === "dm") {
                directConversationsResult.push(conversation);
            }
            else {
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
    }, [filteredConversations, hiddenChatIdSet, lastViewedByConversationId, pinnedChatIdSet, selectedConversation?.id, unreadByConversationId]);
    const resolveConversationUnread = React.useCallback((conversation: Conversation): number => {
        return conversationBuckets.unreadByConversationIdResolved[conversation.id] ?? 0;
    }, [conversationBuckets.unreadByConversationIdResolved]);
    const chatsUnreadTotal = conversationBuckets.chatsUnreadTotal;
    const requestsUnreadTotal = getIncomingUnreadRequestTotal(requests);
    const pendingRequestsCount = pendingRequestsCountProp ?? getOpenPendingRequestCount(requests);
    const junkUnreadTotal = getIncomingUnreadRequestTotal(junkRequests);
    const pendingJunkCount = getIncomingPendingRequestCount(junkRequests);
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
    const renderConversationList = React.useCallback((list: ReadonlyArray<Conversation>) => (list.map((conversation) => {
        const interaction = interactionByConversationId?.[conversation.id];
        return (<ConversationRow key={conversation.id} conversation={conversation} isSelected={selectedConversation?.id === conversation.id} onSelect={selectConversation} unreadCount={resolveConversationUnread(conversation)} isOnline={conversation.kind === "dm" ? Boolean(isPeerOnline?.(conversation.pubkey as PublicKeyHex)) : undefined} lastMessageLabel={formatTime(conversation.lastMessageTime, resolvedNowMs)} lastActiveLabel={conversation.kind === "dm" && interaction?.lastActiveAtMs
                ? formatTime(new Date(interaction.lastActiveAtMs), resolvedNowMs)
                : ""} lastViewedLabel={conversation.kind === "dm" && interaction?.lastViewedAtMs
                ? formatTime(new Date(interaction.lastViewedAtMs), resolvedNowMs)
                : ""} isPinned={pinnedChatIdSet.has(conversation.id)} onTogglePin={togglePin} onHide={hideConversation} onViewProfile={(pubkey) => {
                void router.push(getPublicProfileHref(pubkey));
            }}/>);
    })), [hideConversation, interactionByConversationId, pinnedChatIdSet, resolvedNowMs, resolveConversationUnread, router, selectConversation, selectedConversation?.id, togglePin, isPeerOnline]);
    const listChromeVariant = isMobileShellProduct() ? "mobile" : "desktop";
    const isMobileFlatList = listChromeVariant === "mobile";
    const renderLoadMoreDms = canLoadMoreDms ? (<div className={cn("px-4", isMobileFlatList ? "py-2" : "py-3")}>
            <Button variant="ghost" className="h-9 w-full rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]" onClick={() => setVisibleDmCount((count) => Math.min(count + SIDEBAR_PAGE_STEP, SIDEBAR_MAX_ITEMS))} data-testid="sidebar-load-more-dms">
                {t("common.loadMore")}
            </Button>
        </div>) : null;
    const renderLoadMoreCommunities = canLoadMoreCommunities ? (<div className={cn("px-4", isMobileFlatList ? "py-2" : "py-3")}>
            <Button variant="ghost" className="h-9 w-full rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]" onClick={() => setVisibleCommunityCount((count) => Math.min(count + SIDEBAR_PAGE_STEP, SIDEBAR_MAX_ITEMS))} data-testid="sidebar-load-more-communities">
                {t("common.loadMore")}
            </Button>
        </div>) : null;
    return (<div className="flex h-full min-h-0 flex-col">
            <SidebarListChrome variant={listChromeVariant} activeTab={activeTab} setActiveTab={setActiveTab} chatsUnreadTotal={chatsUnreadTotal} requestsUnreadTotal={requestsUnreadTotal} pendingRequestsCount={pendingRequestsCount} pendingRequestsBadgeDismissed={pendingRequestsBadgeDismissed} onDismissPendingRequestsBadge={onDismissPendingRequestsBadge} junkUnreadTotal={junkUnreadTotal} pendingJunkCount={pendingJunkCount} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchInputRef={searchInputRef} searchDismissSignal={searchDismissSignal} onUserSelect={() => {
            setIsNewChatOpen(true);
        }} chatViewMode={chatViewMode} setChatViewMode={setChatViewMode} dmsUnread={dmsUnread} groupsUnread={groupsUnread} setIsNewChatOpen={setIsNewChatOpen} setIsNewGroupOpen={setIsNewGroupOpen} areChatSectionsExpanded={areChatSectionsExpanded} onToggleChatSectionsExpanded={() => {
            const nextExpanded = !areChatSectionsExpanded;
            setIsDmsExpanded(nextExpanded);
            setIsCommunitiesExpanded(nextExpanded);
        }} onClearRequestHistory={onClearHistory}/>

            <div className="mobile-scroll-region flex-1 min-h-0 overflow-y-auto">
                {activeTab === "junk" ? (<RequestsInboxPanel variant="junk" requests={junkRequests} nowMs={resolvedNowMs} onSelect={onSelectRequest} onFindSomeone={() => setIsNewChatOpen(true)} onClearHistory={onClearHistory}/>) : activeTab === "requests" ? (<RequestsInboxPanel requests={requests} nowMs={resolvedNowMs} onSelect={onSelectRequest} onFindSomeone={() => setIsNewChatOpen(true)} onClearHistory={onClearHistory} onDismissPendingCount={onDismissPendingRequestsBadge} pendingCountDismissed={pendingRequestsBadgeDismissed}/>) : (<>
                        {!hasHydrated ? (<div className="space-y-2 p-3">
                                {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="flex items-start gap-4 p-3 h-20">
                                        <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse"/>
                                        <div className="flex-1 space-y-3 py-1">
                                            <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse"/>
                                            <div className="h-3 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse"/>
                                        </div>
                                    </div>))}
                            </div>) : showHistorySyncNotice && pinnedConversations.length === 0 && cappedDms.length === 0 && cappedCommunities.length === 0 ? (<div className="space-y-2 p-3">
                                {Array.from({ length: 5 }).map((_, i) => (<div key={`sync-skeleton-${i}`} className="flex items-start gap-4 p-3 h-20 rounded-xl border border-indigo-500/10 bg-indigo-500/5">
                                        <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse"/>
                                        <div className="flex-1 space-y-3 py-1">
                                            <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse"/>
                                            <div className="h-3 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse"/>
                                        </div>
                                    </div>))}
                                <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-700/80 dark:text-indigo-300/80">
                                    Syncing history on this device...
                                </p>
                            </div>) : (<>
                                {pinnedConversations.length > 0 && (<div className={isMobileFlatList ? "mb-2" : "mb-4"}>
                                        <div className={cn("flex items-center gap-2 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-400", isMobileFlatList ? "py-1.5" : "py-2")}>
                                            <Pin className="h-3 w-3"/>
                                            {t("messaging.pinned")}
                                        </div>
                                        {renderConversationList(pinnedConversations)}
                                    </div>)}

                                {chatViewMode === "direct" && (<div className="animate-in fade-in slide-in-from-right-1 duration-200">
                                        {isMobileFlatList ? (<>
                                                {renderConversationList(visibleDms)}
                                                {renderLoadMoreDms}
                                            </>) : (<>
                                                <button onClick={() => setIsDmsExpanded(!isDmsExpanded)} className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-3 w-3"/>
                                                        {t("messaging.direct_messages")}
                                                    </div>
                                                    {isDmsExpanded ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
                                                </button>
                                                {isDmsExpanded ? (<>
                                                        {renderConversationList(visibleDms)}
                                                        {renderLoadMoreDms}
                                                    </>) : null}
                                            </>)}
                                    </div>)}

                                {chatViewMode === "community" && (<div className={cn("animate-in fade-in slide-in-from-right-1 duration-200", !isMobileFlatList && "mt-4")}>
                                        {isMobileFlatList ? (<>
                                                {renderConversationList(visibleCommunities)}
                                                {renderLoadMoreCommunities}
                                            </>) : (<>
                                                <button onClick={() => setIsCommunitiesExpanded(!isCommunitiesExpanded)} className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="h-3 w-3"/>
                                                        {t("messaging.communities")}
                                                    </div>
                                                    {isCommunitiesExpanded ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
                                                </button>
                                                {isCommunitiesExpanded ? (<>
                                                        {renderConversationList(visibleCommunities)}
                                                        {renderLoadMoreCommunities}
                                                    </>) : null}
                                            </>)}
                                    </div>)}

                            </>)}
                    </>)}
            </div>
        </div>);
}
