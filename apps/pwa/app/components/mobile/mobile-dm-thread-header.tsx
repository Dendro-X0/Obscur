"use client";
import { ChevronLeft, ImageIcon, Info, MoreVertical, PhoneCall, Search, User, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import type React from "react";
import type { Conversation } from "@/app/features/messaging/types";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/app/components/ui/dropdown-menu";
import { CHAT_HISTORY_SEARCH_OPEN_EVENT } from "@/app/features/messaging/components/messaging-shell-bottom-chrome";
import { resolveMobileThreadTitle } from "./resolve-mobile-thread-title";
export type MobileDmThreadHeaderProps = Readonly<{
    conversation: Conversation;
    onBack: () => void;
    displayNameHint?: string | null;
    isPeerOnline?: boolean;
    groupMemberCount?: number;
    onOpenMedia?: () => void;
    onOpenProfile?: (pubkey: string) => void;
    onOpenInfo?: () => void;
    onSendVoiceCallInvite?: () => void;
    canSendVoiceCallInvite?: boolean;
    onSendVideoCallInvite?: () => void;
    canSendVideoCallInvite?: boolean;
}>;
function resolveSubtitle(conversation: Conversation, params: Readonly<{
    isPeerOnline?: boolean;
    groupMemberCount?: number;
    onlineLabel: string;
    offlineLabel: string;
    membersLabel: (count: number) => string;
}>): string | null {
    if (conversation.kind === "group") {
        if (typeof params.groupMemberCount === "number" && params.groupMemberCount > 0) {
            return params.membersLabel(params.groupMemberCount);
        }
        return null;
    }
    if (params.isPeerOnline === true) {
        return params.onlineLabel;
    }
    if (params.isPeerOnline === false) {
        return params.offlineLabel;
    }
    return null;
}
export function MobileDmThreadHeader({ conversation, onBack, displayNameHint, isPeerOnline, groupMemberCount, onOpenMedia, onOpenProfile, onOpenInfo, onSendVoiceCallInvite, canSendVoiceCallInvite = false, onSendVideoCallInvite, canSendVideoCallInvite = false, }: MobileDmThreadHeaderProps): React.JSX.Element {
    const { t } = useTranslation();
    const profileMetadata = useResolvedProfileMetadata(conversation.kind === "dm" ? conversation.pubkey : null);
    const title = resolveMobileThreadTitle({
        conversation,
        resolvedDisplayName: profileMetadata?.displayName,
        displayNameHint,
    });
    const subtitle = resolveSubtitle(conversation, {
        isPeerOnline,
        groupMemberCount,
        onlineLabel: t("messaging.online"),
        offlineLabel: t("messaging.offline"),
        membersLabel: (count) => t("messaging.memberCount", { count }),
    });
    const menuItems: Array<{
        id: string;
        label: string;
        icon: React.ReactNode;
        onSelect: () => void;
    }> = [];
    menuItems.push({
        id: "search",
        label: t("messaging.searchMessagesInChat"),
        icon: <Search className="h-4 w-4" aria-hidden/>,
        onSelect: () => {
            if (typeof window === "undefined") {
                return;
            }
            window.dispatchEvent(new Event(CHAT_HISTORY_SEARCH_OPEN_EVENT));
        },
    });
    if (conversation.kind === "dm" && onOpenProfile) {
        menuItems.push({
            id: "profile",
            label: t("messaging.viewProfile"),
            icon: <User className="h-4 w-4" aria-hidden/>,
            onSelect: () => onOpenProfile(conversation.pubkey),
        });
    }
    if (conversation.kind === "group" && onOpenInfo) {
        menuItems.push({
            id: "info",
            label: t("messaging.communityInfo"),
            icon: <Info className="h-4 w-4" aria-hidden/>,
            onSelect: onOpenInfo,
        });
    }
    if (onOpenMedia) {
        menuItems.push({
            id: "media",
            label: t("messaging.mediaGallery"),
            icon: <ImageIcon className="h-4 w-4" aria-hidden/>,
            onSelect: onOpenMedia,
        });
    }
    const showVoiceCall = conversation.kind === "dm" && Boolean(onSendVoiceCallInvite) && canSendVoiceCallInvite;
    const showVideoCall = conversation.kind === "dm" && Boolean(onSendVideoCallInvite) && canSendVideoCallInvite;
    const iconButtonClass = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 dark:border-white/10 dark:text-zinc-200";
    return (<header className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-gradient-sidebar/90 px-2 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur dark:border-white/10" data-testid="mobile-thread-header">
      <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-gradient-card text-zinc-700 dark:border-white/10 dark:text-zinc-200" onClick={onBack} aria-label={t("common.back")}>
        <ChevronLeft className="h-5 w-5"/>
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        {subtitle ? (<div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </div>) : null}
      </div>
      {showVoiceCall ? (
        <button type="button" className={iconButtonClass} onClick={onSendVoiceCallInvite} aria-label={t("messaging.voiceCall")} data-testid="mobile-thread-voice-call">
          <PhoneCall className="h-5 w-5" aria-hidden/>
        </button>
      ) : null}
      {showVideoCall ? (
        <button type="button" className={iconButtonClass} onClick={onSendVideoCallInvite} aria-label={t("messaging.videoCall")} data-testid="mobile-thread-video-call">
          <Video className="h-5 w-5" aria-hidden/>
        </button>
      ) : null}
      {menuItems.length > 0 ? (<DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={iconButtonClass} aria-label={t("common.moreActions")}>
              <MoreVertical className="h-5 w-5"/>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {menuItems.map((item) => (<DropdownMenuItem key={item.id} className="gap-2" onSelect={item.onSelect}>
                {item.icon}
                {item.label}
              </DropdownMenuItem>))}
          </DropdownMenuContent>
        </DropdownMenu>) : (!showVoiceCall && !showVideoCall ? (<div className="h-11 w-11 shrink-0" aria-hidden="true"/>) : null)}
    </header>);
}
