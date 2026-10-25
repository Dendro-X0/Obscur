"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { MoreVertical, Plus, User, Users } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { cn } from "@/app/lib/utils";
import { SidebarUserSearch } from "./sidebar-user-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  buildRequestsTabBadge,
  UnreadPill,
  type SidebarListChromeSurfaceProps,
} from "./sidebar-list-chrome-shared";

/** Desktop three-pane list chrome — do not import mobile underline/pill widgets here. */
export function DesktopSidebarListChrome(props: SidebarListChromeSurfaceProps): React.JSX.Element {
  const { t } = useTranslation();
  const {
    activeTab,
    setActiveTab,
    chatsUnreadTotal,
    requestsUnreadTotal,
    pendingRequestsCount,
    pendingRequestsBadgeDismissed = false,
    junkUnreadTotal,
    pendingJunkCount,
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

  const requestsTabBadge = buildRequestsTabBadge({
    requestsUnreadTotal,
    pendingRequestsCount,
    pendingRequestsBadgeDismissed,
  });

  return (
    <div
      className="space-y-4 border-b border-black/[0.03] p-4 dark:border-white/[0.03]"
      data-testid="sidebar-desktop-chrome"
    >
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl text-zinc-500"
              aria-label={t("messaging.sidebar_options")}
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
                      ? t("messaging.collapse_sections")
                      : t("messaging.expand_sections")}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => setChatViewMode(chatViewMode === "direct" ? "community" : "direct")}
                >
                  {chatViewMode === "direct" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  <span>
                    {chatViewMode === "direct"
                      ? t("messaging.show_communities")
                      : t("messaging.show_direct_messages")}
                  </span>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600" onClick={onClearRequestHistory}>
                <span>{t("messaging.clear_history")}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex flex-1 rounded-xl bg-black/[0.03] p-1 ring-1 ring-black/5 dark:bg-white/[0.03] dark:ring-white/5">
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={cn(
              "z-10 flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold transition-all",
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
              "z-10 flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold transition-all",
              activeTab === "requests"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
            )}
          >
            {t("nav.requests")}
            {requestsTabBadge}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("junk")}
            className={cn(
              "z-10 flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold transition-all",
              activeTab === "junk"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-white dark:ring-white/5"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
            )}
          >
            {t("nav.junk")}
            {junkUnreadTotal > 0 ? (
              <UnreadPill count={junkUnreadTotal} className="bg-amber-500" />
            ) : pendingJunkCount > 0 ? (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] text-white">
                {pendingJunkCount}
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
            aria-label={chatViewMode === "direct" ? t("messaging.new_chat") : t("messaging.new_group")}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
