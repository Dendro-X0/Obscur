"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTauri } from "@/app/features/desktop/hooks/use-tauri";
import { useDesktopNotifications } from "@/app/features/desktop/hooks/use-desktop-notifications";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { useGlobalVoiceCallOverlayState } from "@/app/features/messaging/services/realtime-voice-global-ui-store";

const MAX_RECENT_MESSAGE_IDS = 400;
const RECENT_MESSAGE_WINDOW_MS = 5 * 60_000;
const MAX_MESSAGE_EVENT_AGE_MS = 2 * 60_000;
const MESSAGE_TONE_COOLDOWN_MS = 2_200;
const MAX_RECENT_CALL_NOTIFICATION_KEYS = 120;
const RECENT_CALL_NOTIFICATION_WINDOW_MS = 2 * 60_000;
const CALL_NOTIFICATION_BODY_MAX_LENGTH = 90;

const isForeground = (): boolean => (
    typeof document !== "undefined"
    && document.visibilityState === "visible"
    && document.hasFocus()
);

const toRoomIdHint = (roomIdInput: string): string => {
    const roomId = roomIdInput.trim();
    if (!roomId) {
        return "unknown-room";
    }
    if (roomId.length <= 24) {
        return roomId;
    }
    return `${roomId.slice(0, 10)}...${roomId.slice(-10)}`;
};

/**
 * Global component to handle background desktop notifications
 * Mounted in root layout
 */
export const DesktopNotificationHandler = () => {
    useTauri();
    const pathname = usePathname();
    const { selectedConversation } = useMessaging();
    const { showNotification, enabled, channels } = useDesktopNotifications();
    const globalVoiceOverlay = useGlobalVoiceCallOverlayState();
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const recentlyNotifiedMessageIdsRef = useRef<Map<string, number>>(new Map());
    const recentlyNotifiedCallKeysRef = useRef<Map<string, number>>(new Map());
    const lastTonePlayedAtUnixMsRef = useRef<number>(0);

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

    useEffect((): (() => void) => {
        unsubscribeRef.current = messageBus.subscribe((event) => {
            if (event.type !== "new_message") {
                return;
            }
            if (event.message.isOutgoing) {
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
                pathname === "/"
                && selectedConversation?.id === event.conversationId
                && isForeground()
            );
            if (isViewingSameConversation) {
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
            const senderName = (
                senderProfile?.displayName
                || senderProfile?.name
                || "Unknown sender"
            );
            const preview = event.message.content.trim();
            const normalizedPreview = preview.length > 0 ? preview : "Sent a message";
            if (enabled && channels.dmMessages) {
                void showNotification(
                    `New message from ${senderName}`,
                    normalizedPreview.length > 90 ? `${normalizedPreview.slice(0, 90)}...` : normalizedPreview,
                    "dmMessages"
                );
                playSubtleMessageTone();
            }
        });
        return (): void => {
            unsubscribeRef.current?.();
        };
    }, [channels.dmMessages, enabled, pathname, playSubtleMessageTone, selectedConversation?.id, showNotification]);

    useEffect((): void => {
        if (!enabled || !channels.invitesSystem) {
            return;
        }
        const status = globalVoiceOverlay.status;
        if (!status || status.phase !== "ringing_incoming") {
            return;
        }
        if (isForeground()) {
            return;
        }
        const dedupeKey = `${status.peerPubkey.trim()}|${status.roomId.trim()}`;
        if (!dedupeKey || dedupeKey === "|") {
            return;
        }

        const now = Date.now();
        const recent = recentlyNotifiedCallKeysRef.current;
        const knownAt = recent.get(dedupeKey) ?? 0;
        if (knownAt > 0 && (now - knownAt) <= RECENT_CALL_NOTIFICATION_WINDOW_MS) {
            return;
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

        const displayName = globalVoiceOverlay.peerDisplayName?.trim() || "Unknown caller";
        const body = `Room: ${toRoomIdHint(status.roomId)}`;
        const boundedBody = body.length > CALL_NOTIFICATION_BODY_MAX_LENGTH
            ? `${body.slice(0, CALL_NOTIFICATION_BODY_MAX_LENGTH)}...`
            : body;
        void showNotification(
            `Incoming call from ${displayName}`,
            boundedBody,
            "invitesSystem",
        );
    }, [channels.invitesSystem, enabled, globalVoiceOverlay.peerDisplayName, globalVoiceOverlay.status, showNotification]);

    // This component doesn't render anything
    return null;
};
