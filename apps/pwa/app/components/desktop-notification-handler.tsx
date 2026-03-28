"use client";

import { useEffect, useRef } from "react";
import { useTauri } from "@/app/features/desktop/hooks/use-tauri";
import { useDesktopNotifications } from "@/app/features/desktop/hooks/use-desktop-notifications";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";

const MAX_RECENT_MESSAGE_IDS = 400;
const RECENT_MESSAGE_WINDOW_MS = 5 * 60_000;

/**
 * Global component to handle background desktop notifications
 * Mounted in root layout
 */
export const DesktopNotificationHandler = () => {
    useTauri();
    const { showNotification } = useDesktopNotifications();
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const recentlyNotifiedMessageIdsRef = useRef<Map<string, number>>(new Map());

    useEffect((): (() => void) => {
        unsubscribeRef.current = messageBus.subscribe((event) => {
            if (event.type !== "new_message") {
                return;
            }
            if (event.message.isOutgoing) {
                return;
            }
            const isBackgrounded = (
                typeof document !== "undefined"
                && (document.visibilityState !== "visible" || !document.hasFocus())
            );
            if (!isBackgrounded) {
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
            showNotification(
                `New message from ${senderName}`,
                normalizedPreview.length > 90 ? `${normalizedPreview.slice(0, 90)}...` : normalizedPreview,
                "dmMessages"
            );
        });
        return (): void => {
            unsubscribeRef.current?.();
        };
    }, [showNotification]);

    // This component doesn't render anything
    return null;
};
