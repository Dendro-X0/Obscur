"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { MoreVertical, Plus, User, Users } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { cn } from "@/app/lib/utils";
import { SidebarUserSearch } from "./sidebar-user-search";
import type { ProfileSearchResult } from "../../search/services/profile-search-service";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

export type SidebarListChromeTab = "chats" | "requests";
export type SidebarListChromeChatMode = "direct" | "community";

type SidebarListChromeProps = Readonly<{
    variant: "desktop" | "mobile";
    activeTab: SidebarListChromeTab;
    setActiveTab: (tab: SidebarListChromeTab) => void;
    chatsUnreadTotal: number;
    requestsUnreadTotal: number;
    pendingRequestsCount: number;
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    searchDismissSignal: string;
    onUserSelect: (user: ProfileSearchResult) => void;
    chatViewMode: SidebarListChromeChatMode;
    setChatViewMode: (mode: SidebarListChromeChatMode) => void;
    dmsUnread: number;
    groupsUnread: number;
    setIsNewChatOpen: (open: boolean) => void;
    setIsNewGroupOpen: (open: boolean) => void;
    areChatSectionsExpanded: boolean;
    onToggleChatSectionsExpanded: () => void;
    onClearRequestHistory: () => void;
}>;

function UnreadPill({ count, className }: Readonly<{ count: number; className?: string }>): React.JSX.Element | null {
    if (count <= 0) {
        return null;
    }
    return (
        <span
            className={cn(
                "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white",
                className,
            )}
        >
            {count > 99 ? "99+" : count}
        </span>
    );
}

function MobileUnderlineTab({
    active,
    label,
    badge,
    onClick,
}: Readonly<{
    active: boolean;
    label: string;
    badge?: React.ReactNode;
    onClick: () => void;
}>): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors",
                active
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
        >
            {label}
            {badge}
            {active ? (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-purple-500" aria-hidden />
            ) : null}
        </button>
    );
}

function MobileChatModePill({
    active,
    label,
    unread,
    onClick,
}: Readonly<{
    active: boolean;
    label: string;
    unread: number;
    onClick: () => void;
}>): React.JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition-colors",
                active
                    ? "bg-purple-500/15 text-purple-700 ring-1 ring-purple-500/25 dark:text-purple-200"
                    : "bg-black/[0.04] text-zinc-500 hover:bg-black/[0.06] dark:bg-white/[0.06] dark:text-zinc-400",
            )}
        >
            {label}
            <UnreadPill count={unread} className="h-3.5 min-w-[14px] text-[8px]" />
        </button>
    );
}

export function SidebarListChrome(props: SidebarListChromeProps): React.JSX.Element {
    const { t } = useTranslation();
    const {
        variant,
        activeTab,
        setActiveTab,
        chatsUnreadTotal,
        requestsUnreadTotal,
        pendingRequestsCount,
        searchQuery,
        setSearchQuery,
        searchInputRef,
        searchDismissSignal,
        onUserSelect,
        chatViewMode,
        setChatViewMode,
        dmsUnread,
        groupsUnread,
        setIsNewChatOpen,
        setIsNewGroupOpen,
        areChatSectionsExpanded,
        onToggleChatSectionsExpanded,
        onClearRequestHistory,
    } = props;

    if (variant === "mobile") {
        return (
            <div
                className="shrink-0 space-y-3 border-b border-black/[0.03] px-3 pb-3 pt-2 dark:border-white/[0.03]"
                data-testid="sidebar-mobile-chrome"
            >
                <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                        <SidebarUserSearch
                            query={searchQuery}
                            onQueryChange={setSearchQuery}
                            inputRef={searchInputRef}
                            dismissSignal={searchDismissSignal}
                            onUserSelect={onUserSelect}
                        />
                    </div>
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11 shrink-0 rounded-xl"
                        onClick={() => (
                            activeTab === "chats"
                                ? (chatViewMode === "direct" ? setIsNewChatOpen(true) : setIsNewGroupOpen(true))
                                : setIsNewChatOpen(true)
                        )}
                        aria-label={
                            activeTab === "chats" && chatViewMode === "community"
                                ? t("messaging.new_group", "New Group")
                                : t("messaging.new_chat", "New Chat")
                        }
                    >
                        <Plus className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex border-b border-black/[0.04] dark:border-white/[0.06]" role="tablist">
                    <MobileUnderlineTab
                        active={activeTab === "chats"}
                        label={t("nav.chats")}
                        badge={<UnreadPill count={chatsUnreadTotal} />}
                        onClick={() => setActiveTab("chats")}
                    />
                    <MobileUnderlineTab
                        active={activeTab === "requests"}
                        label={t("nav.requests")}
                        badge={
                            requestsUnreadTotal > 0 ? (
                                <UnreadPill count={requestsUnreadTotal} />
                            ) : pendingRequestsCount > 0 ? (
                                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-400 px-1 text-[9px] font-bold text-white dark:bg-zinc-600">
                                    {pendingRequestsCount}
                                </span>
                            ) : null
                        }
                        onClick={() => setActiveTab("requests")}
                    />
                </div>

                {activeTab === "chats" ? (
                    <div className="flex items-center gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <MobileChatModePill
                                active={chatViewMode === "direct"}
                                label={t("messaging.chat")}
                                unread={dmsUnread}
                                onClick={() => setChatViewMode("direct")}
                            />
                            <MobileChatModePill
                                active={chatViewMode === "community"}
                                label={t("messaging.group")}
                                unread={groupsUnread}
                                onClick={() => setChatViewMode("community")}
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-auto h-9 w-9 shrink-0 rounded-lg text-zinc-500"
                                    aria-label={t("messaging.sidebar_options", "Sidebar Options")}
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-[10040] w-48">
                                <DropdownMenuItem className="gap-2" onClick={onToggleChatSectionsExpanded}>
                                    <span>
                                        {areChatSectionsExpanded
                                            ? t("messaging.collapse_sections", "Collapse Sections")
                                            : t("messaging.expand_sections", "Expand Sections")}
                                    </span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className="border-b border-black/[0.03] space-y-4 p-4 dark:border-white/[0.03]">
            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-xl text-zinc-500"
                            aria-label={t("messaging.sidebar_options", "Sidebar Options")}
                        >
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="z-[10040] w-48">
                        {activeTab === "chats" ? (
                            <>
                                <DropdownMenuItem className="gap-2" onClick={onToggleChatSectionsExpanded}>
                                    <span>
                                        {areChatSectionsExpanded
                                            ? t("messaging.collapse_sections", "Collapse Sections")
                                            : t("messaging.expand_sections", "Expand Sections")}
                                    </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => setChatViewMode(chatViewMode === "direct" ? "community" : "direct")}
                                >
                                    {chatViewMode === "direct" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                    <span>
                                        {chatViewMode === "direct"
                                            ? t("messaging.show_communities", "Show Communities")
                                            : t("messaging.show_direct_messages", "Show Direct Messages")}
                                    </span>
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600" onClick={onClearRequestHistory}>
                                <span>{t("messaging.clear_history", "Clear History")}</span>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="relative flex flex-1 rounded-xl bg-black/[0.03] p-1 ring-1 ring-black/5 dark:bg-white/[0.03] dark:ring-white/5">
                    <button
                        type="button"
                        onClick={() => setActiveTab("chats")}
                        className={cn(
                            "z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-bold transition-all",
                            activeTab === "chats"
                                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5"
                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                        )}
                    >
                        {t("nav.chats")}
                        <UnreadPill count={chatsUnreadTotal} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("requests")}
                        className={cn(
                            "z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-bold transition-all",
                            activeTab === "requests"
                                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5"
                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                        )}
                    >
                        {t("nav.requests")}
                        {requestsUnreadTotal > 0 ? (
                            <UnreadPill count={requestsUnreadTotal} />
                        ) : pendingRequestsCount > 0 ? (
                            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-400 px-1 text-[9px] text-white dark:bg-zinc-600">
                                {pendingRequestsCount}
                            </span>
                        ) : null}
                    </button>
                </div>
            </div>

            <SidebarUserSearch
                query={searchQuery}
                onQueryChange={setSearchQuery}
                inputRef={searchInputRef}
                dismissSignal={searchDismissSignal}
                onUserSelect={onUserSelect}
            />

            {activeTab === "chats" ? (
                <div className="flex items-center gap-2">
                    <div className="relative flex flex-1 rounded-xl bg-black/[0.03] p-1 ring-1 ring-black/5 dark:bg-white/[0.03] dark:ring-white/5">
                        <button
                            type="button"
                            onClick={() => setChatViewMode("direct")}
                            className={cn(
                                "z-10 flex flex-1 items-center justify-center rounded-lg py-2 text-[11px] font-bold transition-all",
                                chatViewMode === "direct"
                                    ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                            )}
                        >
                            {t("messaging.chat")}
                            <UnreadPill count={dmsUnread} className="ml-1 h-3.5 min-w-[14px] text-[8px]" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setChatViewMode("community")}
                            className={cn(
                                "z-10 flex flex-1 items-center justify-center rounded-lg py-2 text-[11px] font-bold transition-all",
                                chatViewMode === "community"
                                    ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5"
                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                            )}
                        >
                            {t("messaging.group")}
                            <UnreadPill count={groupsUnread} className="ml-1 h-3.5 min-w-[14px] text-[8px]" />
                        </button>
                    </div>
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-11 w-11 shrink-0 rounded-xl"
                        onClick={() => (chatViewMode === "direct" ? setIsNewChatOpen(true) : setIsNewGroupOpen(true))}
                        aria-label={
                            chatViewMode === "direct"
                                ? t("messaging.new_chat", "New Chat")
                                : t("messaging.new_group", "New Group")
                        }
                    >
                        <Plus className="h-5 w-5" />
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
