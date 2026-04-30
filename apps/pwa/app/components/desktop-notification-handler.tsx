"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTauri } from "@/app/features/desktop/hooks/use-tauri";
import { useDesktopNotifications } from "@/app/features/desktop/hooks/use-desktop-notifications";
import { applyDesktopUnreadTaskbarBadge } from "@/app/features/desktop/utils/unread-taskbar-badge";
import { getTauriAPI } from "@/app/features/desktop/utils/tauri-api";
import { IncomingMessageToastStack, type IncomingMessageToastItem } from "@/app/features/messaging/components/incoming-message-toast";
import { IncomingVoiceCallToast } from "@/app/features/messaging/components/incoming-voice-call-toast";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { isVoiceCallControlPayload, parseVoiceCallInvitePayload } from "@/app/features/messaging/services/realtime-voice-signaling";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { useGlobalVoiceCallOverlayState } from "@/app/features/messaging/services/realtime-voice-global-ui-store";
import { isMessageNotificationEnabledForIncomingEvent } from "@/app/features/notifications/utils/notification-target-preference";
import type { Conversation } from "@/app/features/messaging/types";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import {
    buildConversationNotificationHref,
    buildIncomingCallNotificationPresentation,
    buildMessageNotificationPresentation,
} from "@/app/features/notifications/utils/notification-presentation";
import { isTauri } from "@/app/lib/notification-service";
import {
    dispatchVoiceCallOverlayAction,
    extractVoiceCallOverlayAction,
    type VoiceCallOverlayAction,
} from "@/app/features/messaging/services/voice-call-overlay-action-bridge";

const MAX_RECENT_MESSAGE_IDS = 400;
const RECENT_MESSAGE_WINDOW_MS = 5 * 60_000;
const MAX_MESSAGE_EVENT_AGE_MS = 2 * 60_000;
const MESSAGE_TONE_COOLDOWN_MS = 2_200;
const MAX_RECENT_CALL_NOTIFICATION_KEYS = 120;
const RECENT_CALL_NOTIFICATION_WINDOW_MS = 2 * 60_000;
const MAX_IN_APP_MESSAGE_TOASTS = 3;
const IN_APP_MESSAGE_TOAST_LIFETIME_MS = 7_000;
const UNKNOWN_DISPLAY_NAME_VALUES = new Set([
    "unknown contact",
    "unknown sender",
    "unknown caller",
    "unknown user",
]);

const isForeground = (): boolean => (
    typeof document !== "undefined"
    && document.visibilityState === "visible"
    && document.hasFocus()
);

const isUnknownDisplayName = (value: string | null | undefined): boolean => {
    if (typeof value !== "string") {
        return true;
    }
    const normalized = value.trim().toLowerCase();
    return !normalized || UNKNOWN_DISPLAY_NAME_VALUES.has(normalized);
};

const isViewingTargetConversation = (params: Readonly<{
    pathname: string | null;
    selectedConversation: Conversation | null;
    incomingConversationId: string;
    senderPubkey?: string;
}>): boolean => {
    if (params.pathname !== "/" || !params.selectedConversation) {
        return false;
    }
    if (params.selectedConversation.id === params.incomingConversationId) {
        return true;
    }
    if (params.selectedConversation.kind !== "dm") {
        return false;
    }
    return (
        typeof params.senderPubkey === "string"
        && params.senderPubkey.trim().length > 0
        && params.selectedConversation.pubkey === params.senderPubkey
    );
};

/**
 * Global component to handle background desktop notifications
 * Mounted in root layout
 */
export const DesktopNotificationHandler = () => {
    useTauri();
    const pathname = usePathname();
    const router = useRouter();
    const { selectedConversation, chatsUnreadCount, setUnreadByConversationId, createdConnections } = useMessaging();
    const { showNotification, enabled, channels } = useDesktopNotifications();
    const globalVoiceOverlay = useGlobalVoiceCallOverlayState();
    const accountSyncSnapshot = useAccountSyncSnapshot();
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const recentlyNotifiedMessageIdsRef = useRef<Map<string, number>>(new Map());
    const recentlyNotifiedCallKeysRef = useRef<Map<string, number>>(new Map());
    const lastTonePlayedAtUnixMsRef = useRef<number>(0);
    const lastMessageNotificationAtUnixMsRef = useRef<number>(0);
    const previousUnreadCountRef = useRef<number>(0);
    const trayCallSyncKeyRef = useRef<string>("");
    const inAppMessageToastTimersRef = useRef<Map<string, number>>(new Map());
    const [backgroundAlertCount, setBackgroundAlertCount] = useState<number>(0);
    const [inAppMessageToasts, setInAppMessageToasts] = useState<ReadonlyArray<(IncomingMessageToastItem & Readonly<{
        conversationId: string;
    }>)>>([]);
    const [fallbackIncomingCallCard, setFallbackIncomingCallCard] = useState<null | Readonly<{
        peerPubkey: string;
        roomId: string;
        displayName: string;
        avatarUrl: string;
    }>>(null);
    const callOverlayAnchorMode: "chat" | "page" = pathname === "/" ? "chat" : "page";
    const relayCallActionToChatSurface = useCallback((action: VoiceCallOverlayAction): void => {
        dispatchVoiceCallOverlayAction(action);
        if (
            pathname !== "/"
            && (action === "open_chat" || action === "accept" || action === "decline")
        ) {
            void router.push("/");
        }
    }, [pathname, router]);

    const clearInAppMessageToastTimer = useCallback((id: string): void => {
        const timer = inAppMessageToastTimersRef.current.get(id);
        if (typeof timer === "number") {
            window.clearTimeout(timer);
            inAppMessageToastTimersRef.current.delete(id);
        }
    }, []);

    const dismissInAppMessageToast = useCallback((id: string): void => {
        clearInAppMessageToastTimer(id);
        setInAppMessageToasts((current) => current.filter((entry) => entry.id !== id));
    }, [clearInAppMessageToastTimer]);

    const enqueueInAppMessageToast = useCallback((entry: Readonly<{
        id: string;
        conversationId: string;
        senderDisplayName: string;
        senderAvatarUrl: string;
        preview: string;
        timestampLabel?: string;
        badges?: IncomingMessageToastItem["badges"];
    }>): void => {
        const notificationId = `msg-toast-${entry.id}`;
        clearInAppMessageToastTimer(notificationId);
        setInAppMessageToasts((current) => {
            const deduped = current.filter((value) => value.id !== notificationId);
            const next = [{
                id: notificationId,
                conversationId: entry.conversationId,
                senderDisplayName: entry.senderDisplayName,
                senderAvatarUrl: entry.senderAvatarUrl,
                preview: entry.preview,
                timestampLabel: entry.timestampLabel,
                badges: entry.badges,
            }, ...deduped];
            return next.slice(0, MAX_IN_APP_MESSAGE_TOASTS);
        });
        const timer = window.setTimeout(() => {
            dismissInAppMessageToast(notificationId);
        }, IN_APP_MESSAGE_TOAST_LIFETIME_MS);
        inAppMessageToastTimersRef.current.set(notificationId, timer);
    }, [clearInAppMessageToastTimer, dismissInAppMessageToast]);

    const openInAppMessageToast = useCallback((id: string): void => {
        const target = inAppMessageToasts.find((entry) => entry.id === id);
        dismissInAppMessageToast(id);
        if (!target) {
            void router.push("/");
            return;
        }
        void router.push(`/?convId=${encodeURIComponent(target.conversationId)}`);
    }, [dismissInAppMessageToast, inAppMessageToasts, router]);

    const replyInAppMessageToast = useCallback((id: string): void => {
        const target = inAppMessageToasts.find((entry) => entry.id === id);
        dismissInAppMessageToast(id);
        if (!target) {
            void router.push("/");
            return;
        }
        void router.push(`/?convId=${encodeURIComponent(target.conversationId)}`);
    }, [dismissInAppMessageToast, inAppMessageToasts, router]);

    const markReadInAppMessageToast = useCallback((id: string): void => {
        const target = inAppMessageToasts.find((entry) => entry.id === id);
        dismissInAppMessageToast(id);
        if (!target) {
            return;
        }
        setUnreadByConversationId((current) => {
            const existing = current[target.conversationId] ?? 0;
            if (existing <= 0) {
                return current;
            }
            return {
                ...current,
                [target.conversationId]: 0,
            };
        });
    }, [dismissInAppMessageToast, inAppMessageToasts, setUnreadByConversationId]);

    const shouldNotifyIncomingCall = useCallback((dedupeKey: string): boolean => {
        if (!dedupeKey || dedupeKey === "|") {
            return false;
        }
        const now = Date.now();
        const recent = recentlyNotifiedCallKeysRef.current;
        const knownAt = recent.get(dedupeKey) ?? 0;
        if (knownAt > 0 && (now - knownAt) <= RECENT_CALL_NOTIFICATION_WINDOW_MS) {
            return false;
        }
        recent.set(dedupeKey, now);
        if (recent.size > MAX_RECENT_CALL_NOTIFICATION_KEYS) {
            const cutoff = now - RECENT_CALL_NOTIFICATION_WINDOW_MS;
            for (const [key, observedAt] of recent.entries()) {
                if (observedAt < cutoff) {
                    recent.delete(key);
                }
            }
            if (recent.size > MAX_RECENT_CALL_NOTIFICATION_KEYS) {
                const staleKey = recent.keys().next().value;
                if (typeof staleKey === "string") {
                    recent.delete(staleKey);
                }
            }
        }
        return true;
    }, []);

    const notifyIncomingCall = useCallback((params: Readonly<{
        peerPubkey: string;
        roomId: string;
        displayName: string;
        href?: string;
    }>): void => {
        const canNotifyByPreference = enabled && channels.invitesSystem;
        const forceDesktopNotification = isTauri();
        if (!canNotifyByPreference && !forceDesktopNotification) {
            return;
        }
        const peerPubkey = params.peerPubkey.trim();
        const roomId = params.roomId.trim();
        const dedupeKey = `${peerPubkey}|${roomId}`;
        if (!shouldNotifyIncomingCall(dedupeKey)) {
            return;
        }
        const displayName = params.displayName.trim() || "Unknown caller";
        const shouldSurfaceInteractiveCard = (
            forceDesktopNotification
            && typeof document !== "undefined"
            && document.visibilityState !== "visible"
        );
        if (shouldSurfaceInteractiveCard) {
            // Promote hidden/minimized incoming calls to native popup owner path first.
            void getTauriAPI().tray.setIncomingCallState({
                callerName: displayName,
                roomId,
            }).catch(() => {
                // best effort
            });
            void getTauriAPI().window.showAndFocus().catch(() => {
                // best effort to surface actionable in-app card
            });
            return;
        }
        const presentation = buildIncomingCallNotificationPresentation({
            displayName,
            href: params.href,
        });
        void showNotification(
            presentation.title,
            presentation.body,
            "invitesSystem",
            {
                onClick: () => {
                    relayCallActionToChatSurface("open_chat");
                },
                data: {
                    overlayAction: "open_chat",
                    href: presentation.href,
                },
                requireInteraction: true,
                force: forceDesktopNotification,
                actions: [
                    { action: "open_chat", title: "Open chat" },
                ],
            }
        );
    }, [channels.invitesSystem, enabled, relayCallActionToChatSurface, shouldNotifyIncomingCall, showNotification]);

    useEffect((): (() => void) | void => {
        if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }
        const handleServiceWorkerMessage = (event: MessageEvent<unknown>): void => {
            const payload = event.data;
            if (!payload || typeof payload !== "object") {
                return;
            }
            if ((payload as { type?: unknown }).type !== "OBSCUR_NOTIFICATION_CLICK") {
                return;
            }
            const action = extractVoiceCallOverlayAction({
                action: (payload as { overlayAction?: unknown }).overlayAction,
            });
            if (!action) {
                return;
            }
            relayCallActionToChatSurface(action);
        };
        navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
        return (): void => {
            navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
        };
    }, [relayCallActionToChatSurface]);

    useEffect((): (() => void) | void => {
        if (!isTauri() || typeof window === "undefined") {
            return;
        }
        let disposed = false;
        let unlisten: (() => void) | null = null;
        void (async () => {
            try {
                const { listen } = await import("@tauri-apps/api/event");
                if (disposed) {
                    return;
                }
                unlisten = await listen<unknown>("desktop://incoming-call-action", (event) => {
                    const action = extractVoiceCallOverlayAction(event.payload);
                    if (!action) {
                        return;
                    }
                    relayCallActionToChatSurface(action);
                });
            } catch {
                // best effort desktop bridge only
            }
        })();
        return (): void => {
            disposed = true;
            if (unlisten) {
                unlisten();
            }
        };
    }, [relayCallActionToChatSurface]);

    const playSubtleMessageTone = useCallback((): void => {
        if (typeof window === "undefined") {
            return;
        }
        const now = Date.now();
        if ((now - lastTonePlayedAtUnixMsRef.current) < MESSAGE_TONE_COOLDOWN_MS) {
            return;
        }
        lastTonePlayedAtUnixMsRef.current = now;
        try {
            const AudioContextCtor: typeof AudioContext | undefined =
                window.AudioContext
                || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) {
                return;
            }
            const audioContext = new AudioContextCtor();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(920, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.018, audioContext.currentTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            window.setTimeout(() => {
                void audioContext.close().catch(() => {
                    // best effort cleanup
                });
            }, 260);
        } catch {
            // best effort notification tone only
        }
    }, []);

    useEffect((): void => {
        const unreadFromMessages = Number.isFinite(chatsUnreadCount) ? chatsUnreadCount : 0;
        const effectiveUnreadCount = Math.max(unreadFromMessages, backgroundAlertCount);
        const unreadFromIncomingCall = globalVoiceOverlay.status?.phase === "ringing_incoming" ? 1 : 0;
        void applyDesktopUnreadTaskbarBadge(effectiveUnreadCount + unreadFromIncomingCall);
    }, [backgroundAlertCount, chatsUnreadCount, globalVoiceOverlay.status?.phase]);

    useEffect((): void => {
        const previousUnread = previousUnreadCountRef.current;
        const currentUnread = Number.isFinite(chatsUnreadCount) ? Math.max(0, Math.floor(chatsUnreadCount)) : 0;
        previousUnreadCountRef.current = currentUnread;
        if (currentUnread <= previousUnread) {
            return;
        }
        // CRITICAL FIX: Skip notifications when unread count increases from restore/initialization
        // rather than from live message events. On fresh device login, restored unread counts
        // would otherwise trigger false "new message" notifications for historical messages.
        const isRestoreTimeInitialization = previousUnread === 0 && currentUnread > 5;
        if (isRestoreTimeInitialization) {
            console.log("[NotificationHandler] Skipping notification for restore-time unread initialization:", {
                previousUnread,
                currentUnread,
                reason: "fresh_device_restore",
            });
            return;
        }
        if (isForeground()) {
            return;
        }
        const now = Date.now();
        if ((now - lastMessageNotificationAtUnixMsRef.current) <= 2_500) {
            return;
        }
        const unreadIncrease = Math.max(1, currentUnread - previousUnread);
        lastMessageNotificationAtUnixMsRef.current = now;
        setBackgroundAlertCount((current) => Math.min(999, current + unreadIncrease));
        const forceBackgroundNotification = isTauri();
        const title = unreadIncrease === 1 ? "New message" : `${unreadIncrease} new messages`;
        void showNotification(
            title,
            "Open Obscur to view your conversations.",
            "dmMessages",
            {
                onClick: () => {
                    void router.push("/");
                },
                force: forceBackgroundNotification,
                data: { href: "/" },
            }
        );
        playSubtleMessageTone();
    }, [chatsUnreadCount, playSubtleMessageTone, router, showNotification]);

    useEffect((): (() => void) => {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return () => {};
        }
        const maybeClearBackgroundAlerts = (): void => {
            if (!isForeground()) {
                return;
            }
            setBackgroundAlertCount(0);
        };
        window.addEventListener("focus", maybeClearBackgroundAlerts);
        document.addEventListener("visibilitychange", maybeClearBackgroundAlerts);
        maybeClearBackgroundAlerts();
        return (): void => {
            window.removeEventListener("focus", maybeClearBackgroundAlerts);
            document.removeEventListener("visibilitychange", maybeClearBackgroundAlerts);
        };
    }, []);

    useEffect((): (() => void) => (
        () => {
            for (const timer of inAppMessageToastTimersRef.current.values()) {
                window.clearTimeout(timer);
            }
            inAppMessageToastTimersRef.current.clear();
        }
    ), []);

    useEffect((): void => {
        if (!isTauri()) {
            return;
        }
        const status = globalVoiceOverlay.status;
        const activeIncoming = status?.phase === "ringing_incoming" && Boolean(status.roomId);
        const callerName = globalVoiceOverlay.peerDisplayName?.trim() || "Unknown caller";
        const roomId = status?.roomId?.trim() ?? "";
        const nextSyncKey = activeIncoming ? `${callerName}|${roomId}` : "";
        if (trayCallSyncKeyRef.current === nextSyncKey) {
            return;
        }
        trayCallSyncKeyRef.current = nextSyncKey;
        if (!activeIncoming) {
            void getTauriAPI().tray.setIncomingCallState(null).catch(() => {
                // best effort
            });
            return;
        }
        void getTauriAPI().tray.setIncomingCallState({
            callerName,
            roomId,
        }).catch(() => {
            // best effort
        });
    }, [globalVoiceOverlay.peerDisplayName, globalVoiceOverlay.status]);

    useEffect((): void => {
        if (globalVoiceOverlay.status?.phase === "ringing_incoming" && fallbackIncomingCallCard) {
            setFallbackIncomingCallCard(null);
        }
    }, [fallbackIncomingCallCard, globalVoiceOverlay.status?.phase]);

    useEffect((): (() => void) => {
        unsubscribeRef.current = messageBus.subscribe((event) => {
            if (event.type !== "new_message") {
                return;
            }
            if (event.message.isOutgoing) {
                return;
            }
            // CRITICAL FIX: Skip notifications during account sync/restore
            // Historical messages restored during account sync should not trigger
            // "new message" notifications. Only live messages after sync is complete
            // should notify the user.
            if (accountSyncSnapshot.phase !== "ready") {
                return;
            }
            const messageUnixMs = (
                event.message.eventCreatedAt?.getTime()
                ?? event.message.timestamp.getTime()
            );
            if ((Date.now() - messageUnixMs) > MAX_MESSAGE_EVENT_AGE_MS) {
                return;
            }
            const isViewingSameConversation = (
                isForeground()
                && isViewingTargetConversation({
                    pathname,
                    selectedConversation,
                    incomingConversationId: event.conversationId,
                    senderPubkey: event.message.senderPubkey,
                })
            );
            if (isViewingSameConversation) {
                return;
            }
            if (!isMessageNotificationEnabledForIncomingEvent({
                conversationId: event.conversationId,
                message: event.message,
            })) {
                return;
            }

            const dedupeId = event.message.eventId || event.message.id;
            if (dedupeId) {
                const now = Date.now();
                const recent = recentlyNotifiedMessageIdsRef.current;
                const knownAt = recent.get(dedupeId) ?? 0;
                if (knownAt > 0 && now - knownAt <= RECENT_MESSAGE_WINDOW_MS) {
                    return;
                }
                recent.set(dedupeId, now);
                if (recent.size > MAX_RECENT_MESSAGE_IDS) {
                    const cutoff = now - RECENT_MESSAGE_WINDOW_MS;
                    for (const [messageId, observedAt] of recent.entries()) {
                        if (observedAt < cutoff) {
                            recent.delete(messageId);
                        }
                    }
                    if (recent.size > MAX_RECENT_MESSAGE_IDS) {
                        const staleKey = recent.keys().next().value;
                        if (typeof staleKey === "string") {
                            recent.delete(staleKey);
                        }
                    }
                }
            }

            const senderPubkey = event.message.senderPubkey || "";
            const senderProfile = senderPubkey ? discoveryCache.getProfile(senderPubkey) : null;
            const conversationDisplayName = createdConnections.find((connection) => (
                connection.id === event.conversationId
            ))?.displayName;
            const pubkeyDisplayName = senderPubkey
                ? createdConnections.find((connection) => connection.pubkey === senderPubkey)?.displayName
                : null;
            const profileDisplayName = senderProfile?.displayName || senderProfile?.name || null;
            const senderNameCandidate = (
                !isUnknownDisplayName(profileDisplayName) ? profileDisplayName
                    : (!isUnknownDisplayName(conversationDisplayName) ? conversationDisplayName
                        : (!isUnknownDisplayName(pubkeyDisplayName) ? pubkeyDisplayName : null))
            );
            const senderName = senderNameCandidate || "Unknown contact";
            const preview = event.message.content.trim();
            const normalizedPreview = preview.length > 0 ? preview : "Sent a message";
            const messageTimestampLabel = new Intl.DateTimeFormat(undefined, {
                hour: "numeric",
                minute: "2-digit",
            }).format(new Date(messageUnixMs));
            const messageBadges: Array<NonNullable<IncomingMessageToastItem["badges"]>[number]> = [
                { label: "New", tone: "info" as const },
                { label: "Encrypted", tone: "positive" as const },
            ];
            if (normalizedPreview.includes("@")) {
                messageBadges.splice(1, 0, { label: "Mention", tone: "warning" as const });
            }
            const voiceCallInvite = parseVoiceCallInvitePayload(normalizedPreview);
            if (voiceCallInvite?.roomId) {
                const peerPubkey = (event.message.senderPubkey || voiceCallInvite.fromPubkey || "").trim();
                const href = buildConversationNotificationHref(event.conversationId);
                if (globalVoiceOverlay.status?.phase !== "ringing_incoming") {
                    setFallbackIncomingCallCard({
                        peerPubkey,
                        roomId: voiceCallInvite.roomId,
                        displayName: senderName,
                        avatarUrl: senderProfile?.picture || "",
                    });
                }
                if (!isForeground()) {
                    notifyIncomingCall({
                        peerPubkey,
                        roomId: voiceCallInvite.roomId,
                        displayName: senderName,
                        href,
                    });
                }
                return;
            }
            if (isVoiceCallControlPayload(normalizedPreview)) {
                return;
            }
            const isBackgroundAlert = !isForeground();
            const forceBackgroundNotification = isBackgroundAlert && isTauri();
            if (!isBackgroundAlert) {
                enqueueInAppMessageToast({
                    id: dedupeId || `${event.conversationId}-${messageUnixMs}`,
                    conversationId: event.conversationId,
                    senderDisplayName: senderName,
                    senderAvatarUrl: senderProfile?.picture || "",
                    preview: normalizedPreview.length > 140 ? `${normalizedPreview.slice(0, 140)}...` : normalizedPreview,
                    timestampLabel: messageTimestampLabel,
                    badges: messageBadges,
                });
                playSubtleMessageTone();
                return;
            }
            if (isBackgroundAlert) {
                setBackgroundAlertCount((current) => Math.min(999, current + 1));
            }
            const presentation = buildMessageNotificationPresentation({
                senderName,
                preview: normalizedPreview,
                conversationId: event.conversationId,
                contextLabel: "Direct message",
                timestampLabel: messageTimestampLabel,
            });
            if (enabled && channels.dmMessages) {
                void showNotification(
                    presentation.title,
                    presentation.body,
                    "dmMessages",
                    {
                        onClick: () => {
                            void router.push(presentation.href);
                        },
                        force: forceBackgroundNotification,
                        data: {
                            href: presentation.href,
                        },
                    }
                );
                lastMessageNotificationAtUnixMsRef.current = Date.now();
                playSubtleMessageTone();
            } else if (isBackgroundAlert) {
                void showNotification(
                    presentation.title,
                    presentation.body,
                    "dmMessages",
                    {
                        onClick: () => {
                            void router.push(presentation.href);
                        },
                        force: forceBackgroundNotification,
                        data: {
                            href: presentation.href,
                        },
                    }
                );
                lastMessageNotificationAtUnixMsRef.current = Date.now();
                playSubtleMessageTone();
            }
        });
        return (): void => {
            unsubscribeRef.current?.();
        };
    }, [accountSyncSnapshot.phase, channels.dmMessages, createdConnections, enabled, enqueueInAppMessageToast, globalVoiceOverlay.status?.phase, notifyIncomingCall, pathname, playSubtleMessageTone, selectedConversation?.id, showNotification]);

    useEffect((): void => {
        const status = globalVoiceOverlay.status;
        if (!status || status.phase !== "ringing_incoming") {
            return;
        }
        if (isForeground()) {
            return;
        }
        const peerDisplayNameFromConversations = createdConnections.find((connection) => (
            connection.pubkey === status.peerPubkey
        ))?.displayName;
        const resolvedDisplayNameCandidate = !isUnknownDisplayName(globalVoiceOverlay.peerDisplayName)
            ? globalVoiceOverlay.peerDisplayName
            : (!isUnknownDisplayName(peerDisplayNameFromConversations)
                ? peerDisplayNameFromConversations
                : null);
        const resolvedDisplayName = resolvedDisplayNameCandidate || "Unknown caller";
        const conversationHref = createdConnections.find((connection) => (
            connection.pubkey === status.peerPubkey
        ))?.id;
        notifyIncomingCall({
            peerPubkey: status.peerPubkey,
            roomId: status.roomId,
            displayName: resolvedDisplayName,
            href: conversationHref ? buildConversationNotificationHref(conversationHref) : "/",
        });
    }, [createdConnections, globalVoiceOverlay.peerDisplayName, globalVoiceOverlay.status, notifyIncomingCall]);

    return (
        <>
            <IncomingVoiceCallToast
                isOpen={fallbackIncomingCallCard !== null}
                inviterDisplayName={fallbackIncomingCallCard?.displayName || "Unknown caller"}
                inviterAvatarUrl={fallbackIncomingCallCard?.avatarUrl || ""}
                roomIdHint=""
                anchorMode={callOverlayAnchorMode}
                onOpenChat={() => {
                    void getTauriAPI().tray.setIncomingCallState(null).catch(() => {
                        // best effort
                    });
                    setFallbackIncomingCallCard(null);
                    relayCallActionToChatSurface("open_chat");
                }}
                onAccept={() => {
                    void getTauriAPI().tray.setIncomingCallState(null).catch(() => {
                        // best effort
                    });
                    setFallbackIncomingCallCard(null);
                    relayCallActionToChatSurface("accept");
                }}
                onDecline={() => {
                    void getTauriAPI().tray.setIncomingCallState(null).catch(() => {
                        // best effort
                    });
                    setFallbackIncomingCallCard(null);
                    relayCallActionToChatSurface("decline");
                }}
                onDismiss={() => {
                    void getTauriAPI().tray.setIncomingCallState(null).catch(() => {
                        // best effort
                    });
                    setFallbackIncomingCallCard(null);
                    relayCallActionToChatSurface("dismiss");
                }}
            />
            <IncomingMessageToastStack
                items={inAppMessageToasts}
                onOpen={openInAppMessageToast}
                onReply={replyInAppMessageToast}
                onMarkRead={markReadInAppMessageToast}
                onDismiss={dismissInAppMessageToast}
            />
        </>
    );
};
