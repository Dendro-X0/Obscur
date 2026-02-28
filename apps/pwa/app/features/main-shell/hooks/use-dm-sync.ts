"use client";

import { useEffect, useRef } from "react";
import type { Message, MessagesByConversationId, UnreadByConversationId } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";

/**
 * Hook to sync messages from DmController to the unified message store.
 */
export function useDmSync(
    dmMessages: ReadonlyArray<Message>,
    selectedConversationId: string | null,
    setUnreadByConversationId: React.Dispatch<React.SetStateAction<UnreadByConversationId>>,
    isReady: boolean = true
) {
    const prevMessagesRef = useRef<Record<string, Message>>({});
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        const unreadUpdates: Record<string, number> = {};
        const currentMessages: Record<string, Message> = {};

        dmMessages.forEach(m => {
            currentMessages[m.id] = m;
            const cid = m.conversationId;
            if (!cid) return;

            const prev = prevMessagesRef.current[m.id];

            if (!prev) {
                // Emit to MessageBus and increment unread ONLY if we are fully initialized
                // This prevents hydration from treating hundreds of stored messages as "new"
                if (hasInitializedRef.current) {
                    messageBus.emitNewMessage(cid, m);

                    // Track for unread count increment if not outgoing and not selected
                    if (!m.isOutgoing && cid !== selectedConversationId) {
                        unreadUpdates[cid] = (unreadUpdates[cid] || 0) + 1;
                    }
                }
            } else {
                // Update if changed
                if (
                    prev.status !== m.status ||
                    prev.content !== m.content ||
                    JSON.stringify(prev.reactions) !== JSON.stringify(m.reactions)
                ) {
                    // Emit update to MessageBus
                    messageBus.emitMessageUpdated(cid, m);
                }
            }
        });

        prevMessagesRef.current = currentMessages;

        if (isReady && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
        }

        if (Object.keys(unreadUpdates).length > 0) {
            setUnreadByConversationId(prev => {
                const next = { ...prev };
                Object.entries(unreadUpdates).forEach(([cid, count]) => {
                    next[cid] = (next[cid] || 0) + count;
                });
                return next;
            });
        }
    }, [dmMessages, selectedConversationId, setUnreadByConversationId]);
}
