"use client";

import { useEffect, useRef } from "react";
import type { Message, MessagesByConversationId } from "@/app/features/messaging/types";

/**
 * Hook to sync messages from DmController to the unified message store.
 */
export function useDmSync(
    dmMessages: ReadonlyArray<Message>,
    setMessagesByConversationId: React.Dispatch<React.SetStateAction<MessagesByConversationId>>
) {
    const lastProcessedCountRef = useRef(0);

    useEffect(() => {
        if (dmMessages.length === 0) return;
        if (dmMessages.length === lastProcessedCountRef.current) return;

        setMessagesByConversationId(prev => {
            const next = { ...prev };

            dmMessages.forEach(m => {
                const cid = m.conversationId;
                if (!cid) return;

                const existing = next[cid] || [];
                const alreadyExists = existing.some(ex => ex.id === m.id);

                if (!alreadyExists) {
                    // Prepend or append? DM controller returns messages sorted newest first or oldest first?
                    // MessageList expect them sorted oldest to newest (ascending) usually.
                    // DM Controller state.messages is usually newest first.
                    // Let's assume ascending for the unified store as that's what ChatView likes.
                    const updated = [...existing, m].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                    next[cid] = updated;
                } else {
                    // Update status/reactions if changed?
                    // useCommandMessages handles status updates, but we could do it here too.
                    next[cid] = existing.map(ex => ex.id === m.id ? m : ex);
                }
            });

            return next;
        });

        lastProcessedCountRef.current = dmMessages.length;
    }, [dmMessages, setMessagesByConversationId]);
}
