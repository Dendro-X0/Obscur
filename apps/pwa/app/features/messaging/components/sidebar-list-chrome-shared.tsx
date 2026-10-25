"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";
import type { ProfileSearchResult } from "../../search/services/profile-search-service";
import type { MessagingSidebarTab } from "../services/messaging-sidebar-tab";

export type SidebarListChromeTab = MessagingSidebarTab;
export type SidebarListChromeChatMode = "direct" | "community";

export type SidebarListChromeProps = Readonly<{
  variant: "desktop" | "mobile";
  activeTab: SidebarListChromeTab;
  setActiveTab: (tab: SidebarListChromeTab) => void;
  chatsUnreadTotal: number;
  requestsUnreadTotal: number;
  pendingRequestsCount: number;
  pendingRequestsBadgeDismissed?: boolean;
  onDismissPendingRequestsBadge?: () => void;
  junkUnreadTotal: number;
  pendingJunkCount: number;
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

export type SidebarListChromeSurfaceProps = Omit<SidebarListChromeProps, "variant">;

export function UnreadPill({ count, className }: Readonly<{
  count: number;
  className?: string;
}>): React.JSX.Element | null {
  if (count <= 0) {
    return null;
  }
  return (
    <span className={cn(
      "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white",
      className,
    )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export const buildRequestsTabBadge = (params: Readonly<{
  requestsUnreadTotal: number;
  pendingRequestsCount: number;
  pendingRequestsBadgeDismissed: boolean;
}>): React.ReactNode => {
  const showPendingRequestsBadge = params.pendingRequestsCount > 0 && !params.pendingRequestsBadgeDismissed;
  if (params.requestsUnreadTotal > 0) {
    return <UnreadPill count={params.requestsUnreadTotal} />;
  }
  if (showPendingRequestsBadge) {
    return (
      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-zinc-400 px-1 text-[9px] font-bold text-white dark:bg-zinc-600">
        {params.pendingRequestsCount}
      </span>
    );
  }
  return null;
};
