import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { useTranslation } from "react-i18next";
import type { Conversation } from "../types";
import { useResolvedProfileMetadata } from "../../profile/hooks/use-resolved-profile-metadata";
import { formatTime } from "../utils/formatting";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import {
    getNotificationTargetEnabled,
    setNotificationTargetEnabled,
    subscribeNotificationTargetPreferenceChanges,
    type NotificationTarget,
} from "../../notifications/utils/notification-target-preference";
import { Bell, BellOff, Copy, PhoneCall } from "lucide-react";

export interface ChatHeaderProps {
    conversation: Conversation;
    isOnline?: boolean;
    interactionStatus?: Readonly<{ lastActiveAtMs?: number; lastViewedAtMs?: number }>;
    nowMs?: number | null;
    onCopyPubkey: (pubkey: string) => void;
    onOpenMedia: () => void;
    onToggleConversationNotifications?: (params: Readonly<{ conversation: Conversation; enabled: boolean }>) => void;
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
}

export function ChatHeader({
    conversation,
    isOnline = false,
    interactionStatus,
    nowMs,
    onCopyPubkey,
    onOpenMedia,
    onToggleConversationNotifications,
    onOpenInfo,
    onOpenProfile,
    onSendVoiceCallInvite,
    canSendVoiceCallInvite = true,
    isSendingVoiceCallInvite = false,
    activeVoiceCallState,
    voiceCallStatus,
    onLeaveVoiceCall,
    onAcceptIncomingVoiceCall,
    onDeclineIncomingVoiceCall,
}: ChatHeaderProps) {
    const { t } = useTranslation();
    const metadata = useResolvedProfileMetadata(conversation.kind === "dm" ? conversation.pubkey : null);
    const resolvedName = metadata?.displayName || conversation.displayName;
    const isDeletedRecipient = conversation.kind === "dm" && metadata?.isDeleted === true;
    const effectiveIsOnline = isOnline && !isDeletedRecipient;
    const [showPublicKeyControlsInChat, setShowPublicKeyControlsInChat] = React.useState<boolean>(() => (
        PrivacySettingsService.getSettings().showPublicKeyControlsInChat === true
    ));
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
    const [notificationsEnabled, setNotificationsEnabled] = React.useState<boolean>(() => (
        getNotificationTargetEnabled(notificationTarget)
    ));
    const [isPubkeyPanelVisible, setIsPubkeyPanelVisible] = React.useState(false);
    React.useEffect(() => {
        setIsPubkeyPanelVisible(false);
    }, [conversation.id]);
    React.useEffect(() => {
        setNotificationsEnabled(getNotificationTargetEnabled(notificationTarget));
    }, [notificationTarget]);
    React.useEffect(() => {
        return subscribeNotificationTargetPreferenceChanges(() => {
            setNotificationsEnabled(getNotificationTargetEnabled(notificationTarget));
        });
    }, [notificationTarget]);
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
    const lastActiveLabel = (
        interactionStatus?.lastActiveAtMs
            ? formatTime(new Date(interactionStatus.lastActiveAtMs), resolvedNowMs)
            : ""
    );
    const lastViewedLabel = (
        interactionStatus?.lastViewedAtMs
            ? formatTime(new Date(interactionStatus.lastViewedAtMs), resolvedNowMs)
            : ""
    );
    const handleToggleConversationNotifications = React.useCallback(() => {
        const next = !notificationsEnabled;
        setNotificationsEnabled(next);
        setNotificationTargetEnabled({ target: notificationTarget, enabled: next });
        onToggleConversationNotifications?.({ conversation, enabled: next });
    }, [conversation, notificationTarget, notificationsEnabled, onToggleConversationNotifications]);
    const notificationToggleLabel = notificationsEnabled
        ? t("messaging.notifications.disableForChat", "Disable notifications for this chat")
        : t("messaging.notifications.enableForChat", "Enable notifications for this chat");

    return (
        <div className="flex items-center justify-between border-b border-black/10 bg-white/60 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/60">
            <div className="flex items-center gap-3">
                {conversation.kind === "dm" && onOpenProfile ? (
                    <button
                        type="button"
                        className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-900 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-zinc-100 dark:text-zinc-900"
                        onClick={() => onOpenProfile(conversation.pubkey)}
                        aria-label={t("network.actions.viewProfile", "View Profile")}
                        title={t("network.actions.viewProfile", "View Profile")}
                        data-testid="chat-header-avatar-button"
                    >
                        {metadata?.avatarUrl ? (
                            <Image src={metadata.avatarUrl} alt={resolvedName || "User"} width={36} height={36} className="h-full w-full object-cover" unoptimized />
                        ) : (
                            (resolvedName?.[0] || "?").toUpperCase()
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-black ${effectiveIsOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                    </button>
                ) : (
                    <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                        {metadata?.avatarUrl ? (
                            <Image src={metadata.avatarUrl} alt={resolvedName || "User"} width={36} height={36} className="h-full w-full object-cover" unoptimized />
                        ) : (
                            (resolvedName?.[0] || "?").toUpperCase()
                        )}
                        {conversation.kind === "dm" ? (
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-black ${effectiveIsOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                        ) : null}
                    </div>
                )}
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold tracking-tight">{resolvedName}</h2>
                        <button
                            type="button"
                            onClick={handleToggleConversationNotifications}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                                notificationsEnabled
                                    ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
                                    : "border-rose-500/35 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300"
                            }`}
                            aria-label={notificationToggleLabel}
                            title={notificationToggleLabel}
                            aria-pressed={notificationsEnabled}
                            data-state={notificationsEnabled ? "enabled" : "disabled"}
                            data-testid="chat-header-notification-toggle"
                        >
                            {notificationsEnabled ? (
                                <Bell className="h-3.5 w-3.5" />
                            ) : (
                                <BellOff className="h-3.5 w-3.5" />
                            )}
                        </button>
                    </div>
                    {conversation.kind === "dm" ? (
                        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            <span className="mr-2 inline-flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${effectiveIsOnline ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`} />
                                <span className={`font-bold uppercase tracking-wider ${effectiveIsOnline ? "text-emerald-500" : "text-zinc-500"}`}>
                                    {isDeletedRecipient
                                        ? t("common.unavailable", "Unavailable")
                                        : (effectiveIsOnline ? "Online" : "Offline")}
                                </span>
                            </span>
                            {!isDeletedRecipient
                                ? (lastActiveLabel ? `Last active ${lastActiveLabel}` : "No recent activity")
                                : t("messaging.deletedAccountNoActivity", "Contact removed")}
                            {!isDeletedRecipient && lastViewedLabel ? ` | Last viewed ${lastViewedLabel}` : ""}
                        </p>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2">
                        {conversation.kind === "dm" ? (
                            <>
                                {showPublicKeyControlsInChat ? (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="px-2 py-1"
                                        onClick={() => setIsPubkeyPanelVisible((current) => !current)}
                                    >
                                        {isPubkeyPanelVisible
                                            ? t("common.hide", "Hide")
                                            : t("messaging.shareIdentity", "Share ID")}
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="px-2 py-1"
                                    onClick={onSendVoiceCallInvite}
                                    disabled={!onSendVoiceCallInvite || !canSendVoiceCallInvite || isSendingVoiceCallInvite || isDeletedRecipient}
                                >
                                    <PhoneCall className="mr-1 h-3.5 w-3.5" />
                                    {isSendingVoiceCallInvite
                                        ? t("common.sending", "Sending...")
                                        : (isDeletedRecipient
                                            ? t("messaging.voiceCallUnavailable", "Voice Unavailable")
                                            : t("messaging.voiceCall", "Voice Call"))}
                                </Button>
                            </>
                        ) : (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                {t("messaging.membersCount", { count: conversation.memberPubkeys.length })}
                            </p>
                        )}
                        <Button type="button" variant="secondary" className="px-2 py-1" onClick={onOpenMedia}>
                            {t("messaging.media")}
                        </Button>
                        {conversation.kind === "group" && (
                            <Button type="button" variant="secondary" className="px-2 py-1" onClick={onOpenInfo}>
                                {t("common.info")}
                            </Button>
                        )}
                    </div>
                    {conversation.kind === "dm" && showPublicKeyControlsInChat && isPubkeyPanelVisible ? (
                        <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-2.5 py-1.5 text-[11px] dark:border-white/10 dark:bg-white/[0.03]">
                            <span className="font-mono text-zinc-600 dark:text-zinc-300">
                                {`${conversation.pubkey.slice(0, 16)}...${conversation.pubkey.slice(-8)}`}
                            </span>
                            <Button
                                type="button"
                                variant="secondary"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => onCopyPubkey(conversation.pubkey)}
                            >
                                <Copy className="mr-1 h-3 w-3" />
                                {t("common.copy", "Copy")}
                            </Button>
                        </div>
                    ) : null}
                    {isDeletedRecipient ? (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            {t("Contact account removed. Messaging is read-only.")}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
