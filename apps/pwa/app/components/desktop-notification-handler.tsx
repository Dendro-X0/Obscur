"use client";

import { useEffect, useRef, useState } from "react";
import { useTauri } from "@/app/features/desktop/hooks/use-tauri";
import { useDesktopNotifications } from "@/app/features/desktop/hooks/use-desktop-notifications";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayPool } from "@/app/features/relays/hooks/use-relay-pool";
import { fetchBootstrapConfig } from "@/app/features/onboarding/utils/fetch-bootstrap-config";
import type { Message } from "@/app/features/messaging/lib/message-queue";

/**
 * Global component to handle background desktop notifications
 * Mounted in root layout
 */
export const DesktopNotificationHandler = () => {
    useTauri();
    const { showNotification } = useDesktopNotifications();
    const identity = useIdentity();
    const [relayUrls, setRelayUrls] = useState<string[]>([]);
    const hasSubscribedRef = useRef<boolean>(false);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    const myPublicKeyHex = identity.state.publicKeyHex;
    const myPrivateKeyHex = identity.state.privateKeyHex;

    const pool = useRelayPool(relayUrls);

    // Initialize controller for background listening
    const dmController = useEnhancedDmController({
        myPublicKeyHex: myPublicKeyHex || null,
        myPrivateKeyHex: myPrivateKeyHex || null,
        pool,
        onNewMessage: (message: Message) => {
            // Only show notification if window is not focused/visible
            // and it's an incoming message
            if (!message.isOutgoing) {
                showNotification(
                    `New message from ${message.senderPubkey?.slice(0, 8) ?? "unknown"}`,
                    message.content.length > 50 ? `${message.content.slice(0, 50)}...` : message.content
                );
            }
        }
    });

    useEffect((): void => {
        unsubscribeRef.current = dmController.unsubscribeFromDMs;
    }, [dmController.unsubscribeFromDMs]);

    // Load bootstrap config for relays
    useEffect(() => {
        const loadConfig = async () => {
            const result = await fetchBootstrapConfig();
            if (result.data?.relays) {
                setRelayUrls([...result.data.relays]);
            }
        };
        void loadConfig();
    }, []);

    // Auto-subscribe to incoming DMs
    useEffect(() => {
        if (dmController.state.status !== "ready") {
            return;
        }
        if (!myPublicKeyHex) {
            return;
        }
        if (hasSubscribedRef.current) {
            return;
        }
        dmController.subscribeToIncomingDMs();
        hasSubscribedRef.current = true;
    }, [dmController.state.status, dmController.subscribeToIncomingDMs, myPublicKeyHex]);

    useEffect((): (() => void) => {
        return (): void => {
            hasSubscribedRef.current = false;
            unsubscribeRef.current?.();
        };
    }, []);

    // This component doesn't render anything
    return null;
};
