import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import type { Conversation } from "../types";
import { useResolvedProfileMetadata } from "../../profile/hooks/use-resolved-profile-metadata";
import { formatTime } from "../utils/formatting";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { getNotificationTargetEnabled, setNotificationTargetEnabled, type NotificationTarget, } from "../../notifications/utils/notification-target-preference";
import { useOptionalProfileMessageBus } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { subscribeNotificationTargetPreferenceChangedDual } from "@/app/features/profiles/services/subscribe-notification-target-preference-changed-dual";
import { Bell, BellOff, Copy, PhoneCall } from "lucide-react";
import type { ContactTrustSensitivity } from "@/app/features/dm-kernel/contact-trust-sensitivity";
import { DmKernelTrustSensitivityStrip } from "@/app/features/dm-kernel/components/dm-kernel-trust-sensitivity-strip";

export type ChatHeaderContactTrustSensitivity = Readonly<{
    peerPublicKeyHex: string;
    isPeerAccepted?: boolean;
    sensitivity: ContactTrustSensitivity;
    onSensitivityChange: (value: ContactTrustSensitivity) => void;
}>;

export interface ChatHeaderProps {
    conversation: Conversation;
    groupMemberCount?: number;
    groupOnlineMemberCount?: number;
    groupLastActivityAtMs?: number;
    isOnline?: boolean;
    interactionStatus?: Readonly<{
        lastActiveAtMs?: number;
        lastViewedAtMs?: number;
    }>;
    nowMs?: number | null;
    onCopyPubkey: (pubkey: string) => void;
    onOpenMedia: () => void;
    onToggleConversationNotifications?: (params: Readonly<{
        conversation: Conversation;
        enabled: boolean;
    }>) => void;
    onOpenInfo?: () => void;
    onOpenProfile?: (pubkey: string) => void;
    onSendVoiceCallInvite?: () => void;
    canSendVoiceCallInvite?: boolean;
    isSendingVoiceCallInvite?: boolean;
    activeVoiceCallState?: Readonly<{
        roomId: string;
        peerPubkey: string;
        role: "host" | "joiner";
        connectionState: "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";
    }> | null;
    voiceCallStatus?: Readonly<{
        roomId: string;
        peerPubkey: string;
        phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
        role: "host" | "joiner";
        sinceUnixMs: number;
        reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
    }> | null;
    onLeaveVoiceCall?: () => void;
    onAcceptIncomingVoiceCall?: () => void;
    onDeclineIncomingVoiceCall?: () => void;
    /** DM-only defense sensitivity — rendered inside the header block above the chat. */
    contactTrustSensitivity?: ChatHeaderContactTrustSensitivity;
}
export function ChatHeader({ conversation, groupMemberCount, groupOnlineMemberCount, groupLastActivityAtMs, isOnline = false, interactionStatus, nowMs, onCopyPubkey, onOpenMedia, onToggleConversationNotifications, onOpenInfo, onOpenProfile, onSendVoiceCallInvite, canSendVoiceCallInvite = true, isSendingVoiceCallInvite = false, activeVoiceCallState, voiceCallStatus, onLeaveVoiceCall, onAcceptIncomingVoiceCall, onDeclineIncomingVoiceCall, contactTrustSensitivity, }: ChatHeaderProps) {
    const { t } = useTranslation();
    const metadata = useResolvedProfileMetadata(conversation.kind === "dm" ? conversation.pubkey : null);
    const optionalProfileBus = useOptionalProfileMessageBus();
    const resolvedName = metadata?.displayName || conversation.displayName;
    const isDeletedRecipient = conversation.kind === "dm" && metadata?.isDeleted === true;
    const effectiveIsOnline = isOnline && !isDeletedRecipient;
    const [showPublicKeyControlsInChat, setShowPublicKeyControlsInChat] = React.useState<boolean>(() => (PrivacySettingsService.getSettings().showPublicKeyControlsInChat === true));
    const notificationTarget = React.useMemo<NotificationTarget>(() => {
        if (conversation.kind === "dm") {
            return {
                kind: "dm",
                peerPublicKeyHex: conversation.pubkey,
            };
        }
        return {
            kind: "group",
            conversationId: conversation.id,
            groupId: conversation.groupId,
        };
    }, [
        conversation.id,
        conversation.kind,
        conversation.kind === "dm" ? conversation.pubkey : "",
        conversation.kind === "group" ? (conversation.groupId ?? "") : "",
    ]);
    const [notificationsEnabled, setNotificationsEnabled] = React.useState<boolean>(() => (getNotificationTargetEnabled(notificationTarget, getResolvedProfileId())));
    const [isPubkeyPanelVisible, setIsPubkeyPanelVisible] = React.useState(false);
    React.useEffect(() => {
        setIsPubkeyPanelVisible(false);
    }, [conversation.id]);
    React.useEffect(() => {
        setNotificationsEnabled(getNotificationTargetEnabled(notificationTarget, getResolvedProfileId()));
    }, [notificationTarget]);
    React.useEffect(() => {
        return subscribeNotificationTargetPreferenceChangedDual(() => {
            setNotificationsEnabled(getNotificationTargetEnabled(notificationTarget, getResolvedProfileId()));
        }, optionalProfileBus);
    }, [notificationTarget, optionalProfileBus]);
    React.useEffect(() => {
        const onPrivacySettingsChanged = () => {
            const nextShowPublicKeyControls = PrivacySettingsService.getSettings().showPublicKeyControlsInChat === true;
            setShowPublicKeyControlsInChat(nextShowPublicKeyControls);
            if (!nextShowPublicKeyControls) {
                setIsPubkeyPanelVisible(false);
            }
        };
        if (typeof window !== "undefined") {
            window.addEventListener("privacy-settings-changed", onPrivacySettingsChanged);
            return () => window.removeEventListener("privacy-settings-changed", onPrivacySettingsChanged);
        }
        return;
    }, []);
    const resolvedNowMs = nowMs ?? null;
    const lastActiveLabel = (interactionStatus?.lastActiveAtMs
        ? formatTime(new Date(interactionStatus.lastActiveAtMs), resolvedNowMs)
        : "");
    const lastViewedLabel = (interactionStatus?.lastViewedAtMs
        ? formatTime(new Date(interactionStatus.lastViewedAtMs), resolvedNowMs)
        : "");
    const resolvedGroupMemberCount = groupMemberCount ?? (conversation.kind === "group"
        ? Math.max(conversation.memberCount ?? 0, conversation.memberPubkeys.length, 1)
        : 0);
    const groupLastActivityLabel = (groupLastActivityAtMs
        ? formatTime(new Date(groupLastActivityAtMs), resolvedNowMs)
        : "");
    const handleToggleConversationNotifications = React.useCallback(() => {
        const next = !notificationsEnabled;
        setNotificationsEnabled(next);
        setNotificationTargetEnabled({
            target: notificationTarget,
            enabled: next,
            profileId: getResolvedProfileId(),
        });
        onToggleConversationNotifications?.({ conversation, enabled: next });
    }, [conversation, notificationTarget, notificationsEnabled, onToggleConversationNotifications]);
    const notificationToggleLabel = notificationsEnabled
        ? t("messaging.notifications.disableForChat")
        : t("messaging.notifications.enableForChat");
    const showDmTrustSensitivity = conversation.kind === "dm" && contactTrustSensitivity;
    const headerActionButtonClass = "h-8 shrink-0 px-2.5 text-xs";
    const avatarNode = conversation.kind === "dm" && onOpenProfile ? (
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-zinc-900 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-zinc-100 dark:text-zinc-900"
        onClick={() => onOpenProfile(conversation.pubkey)}
        aria-label={t("network.actions.viewProfile")}
        title={t("network.actions.viewProfile")}
        data-testid="chat-header-avatar-button"
      >
        {metadata?.avatarUrl ? (
          <Image src={metadata.avatarUrl} alt={resolvedName || "User"} width={44} height={44} className="h-full w-full object-cover" unoptimized />
        ) : ((resolvedName?.[0] || "?").toUpperCase())}
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-black ${effectiveIsOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
      </button>
    ) : (
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
        {metadata?.avatarUrl ? (
          <Image src={metadata.avatarUrl} alt={resolvedName || "User"} width={44} height={44} className="h-full w-full object-cover" unoptimized />
        ) : ((resolvedName?.[0] || "?").toUpperCase())}
        {conversation.kind === "dm" ? (
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-black ${effectiveIsOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
        ) : null}
      </div>
    );
    return (<div className="flex shrink-0 border-b border-black/10 bg-white/60 backdrop-blur-xl dark:border-white/10 dark:bg-black/60">
            <div className="w-full px-4 py-3">
            <div className="flex min-h-[3.25rem] items-center gap-3 sm:gap-4" data-testid="chat-header-main-row">
                <div className="shrink-0 self-center" data-testid="chat-header-avatar-slot">
                    {avatarNode}
                </div>
                <div className="min-w-0 flex-1 self-center">
                    <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate font-bold tracking-tight">{resolvedName}</h2>
                        <button type="button" onClick={handleToggleConversationNotifications} className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${notificationsEnabled
            ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
            : "border-rose-500/35 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300"}`} aria-label={notificationToggleLabel} title={notificationToggleLabel} aria-pressed={notificationsEnabled} data-state={notificationsEnabled ? "enabled" : "disabled"} data-testid="chat-header-notification-toggle">
                            {notificationsEnabled ? (<Bell className="h-3.5 w-3.5"/>) : (<BellOff className="h-3.5 w-3.5"/>)}
                        </button>
                    </div>
                    {conversation.kind === "dm" ? (<p className="mt-0.5 truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            <span className="mr-2 inline-flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${effectiveIsOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`}/>
                                <span className={`font-bold uppercase tracking-wider ${effectiveIsOnline ? "text-emerald-500" : "text-zinc-500"}`}>
                                    {isDeletedRecipient
                ? t("common.unavailable")
                : (effectiveIsOnline ? t("messaging.online") : t("messaging.offline"))}
                                </span>
                            </span>
                            {!isDeletedRecipient
                ? (lastActiveLabel ? t("messaging.lastActive", { time: lastActiveLabel }) : t("messaging.noRecentActivity"))
                : t("messaging.deletedAccountNoActivity")}
                            {!isDeletedRecipient && lastViewedLabel ? ` | ${t("messaging.lastViewed", { time: lastViewedLabel })}` : ""}
                        </p>) : conversation.kind === "group" ? (<p className="mt-0.5 truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            <span>
                                {t("messaging.membersCount", { count: resolvedGroupMemberCount })}
                            </span>
                            {groupOnlineMemberCount !== undefined ? (<>
                                    <span className="mx-1.5 text-zinc-400 dark:text-zinc-500">·</span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className={`h-1.5 w-1.5 rounded-full ${groupOnlineMemberCount > 0 ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`}/>
                                        <span className={groupOnlineMemberCount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}>
                                            {t("messaging.groupOnlineCount", {
                    count: groupOnlineMemberCount,
                    defaultValue: "{{count}} online",
                })}
                                        </span>
                                    </span>
                                </>) : null}
                            <span className="mx-1.5 text-zinc-400 dark:text-zinc-500">·</span>
                            <span>
                                {groupLastActivityLabel
                ? t("messaging.groupLastActivity", {
                    time: groupLastActivityLabel,
                    defaultValue: "Last activity {{time}}",
                })
                : t("messaging.groupNoRecentActivity")}
                            </span>
                        </p>) : null}
                </div>
                <div
                  className="flex max-w-[min(100%,20rem)] shrink-0 flex-wrap items-center justify-end gap-1.5 self-center sm:max-w-none sm:gap-2"
                  data-testid="chat-header-action-rail"
                >
                    <div className="hidden h-8 w-px shrink-0 bg-black/10 sm:block dark:bg-white/10" aria-hidden />
                    {conversation.kind === "dm" && showPublicKeyControlsInChat ? (
                      <Button type="button" variant="secondary" className={headerActionButtonClass} onClick={() => setIsPubkeyPanelVisible((current) => !current)}>
                        {isPubkeyPanelVisible ? t("common.hide") : t("messaging.shareIdentity")}
                      </Button>
                    ) : null}
                    {conversation.kind === "dm" ? (
                      <Button type="button" variant="secondary" className={headerActionButtonClass} onClick={onSendVoiceCallInvite} disabled={!onSendVoiceCallInvite || !canSendVoiceCallInvite || isSendingVoiceCallInvite || isDeletedRecipient}>
                        <PhoneCall className="mr-1 h-3.5 w-3.5"/>
                        {isSendingVoiceCallInvite
                          ? t("common.sending")
                          : (isDeletedRecipient ? t("messaging.voiceCallUnavailable") : t("messaging.voiceCall"))}
                      </Button>
                    ) : null}
                    <Button type="button" variant="secondary" className={headerActionButtonClass} onClick={onOpenMedia}>
                      {t("messaging.media")}
                    </Button>
                    {conversation.kind === "group" ? (
                      <Button type="button" variant="secondary" className={headerActionButtonClass} onClick={onOpenInfo}>
                        {t("common.info")}
                      </Button>
                    ) : null}
                    {showDmTrustSensitivity ? (
                      <DmKernelTrustSensitivityStrip
                        embedded
                        headerInline
                        peerPublicKeyHex={contactTrustSensitivity.peerPublicKeyHex}
                        isPeerAccepted={contactTrustSensitivity.isPeerAccepted}
                        sensitivity={contactTrustSensitivity.sensitivity}
                        onSensitivityChange={contactTrustSensitivity.onSensitivityChange}
                      />
                    ) : null}
                </div>
            </div>

            {conversation.kind === "dm" && showPublicKeyControlsInChat && isPubkeyPanelVisible ? (<div className="mt-2.5 inline-flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-2.5 py-1.5 text-[11px] dark:border-white/10 dark:bg-white/[0.03]">
                            <span className="font-mono text-zinc-600 dark:text-zinc-300">
                                {`${conversation.pubkey.slice(0, 16)}...${conversation.pubkey.slice(-8)}`}
                            </span>
                            <Button type="button" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => onCopyPubkey(conversation.pubkey)}>
                                <Copy className="mr-1 h-3 w-3"/>
                                {t("common.copy")}
                            </Button>
                        </div>) : null}
            {isDeletedRecipient ? (<div className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            {t("Contact account removed. Messaging is read-only.")}
                        </div>) : null}
            </div>
        </div>);
}
