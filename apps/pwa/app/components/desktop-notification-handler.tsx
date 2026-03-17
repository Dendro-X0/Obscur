"use client";

import { useEffect, useRef } from "react";
import { useTauri } from "@/app/features/desktop/hooks/use-tauri";
import { useDesktopNotifications } from "@/app/features/desktop/hooks/use-desktop-notifications";
import { messageBus } from "@/app/features/messaging/services/message-bus";

/**
 * Global component to handle background desktop notifications
 * Mounted in root layout
 */
export const DesktopNotificationHandler = () => {
    useTauri();
    const { showNotification } = useDesktopNotifications();
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect((): (() => void) => {
        unsubscribeRef.current = messageBus.subscribe((event) => {
            if (event.type !== "new_message") {
                return;
            }
            if (event.message.isOutgoing) {
                return;
            }
            showNotification(
                `New message from ${event.message.senderPubkey?.slice(0, 8) ?? "unknown"}`,
                event.message.content.length > 50 ? `${event.message.content.slice(0, 50)}...` : event.message.content,
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
