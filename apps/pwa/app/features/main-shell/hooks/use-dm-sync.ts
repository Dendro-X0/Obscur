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
        // We removed the length check to ensure status updates and the first message arrival 
        // trigger the effect properly.

        setMessagesByConversationId(prev => {
            const next = { ...prev };
            let hasChanged = false;

            dmMessages.forEach(m => {
                const cid = m.conversationId;
                if (!cid) return;

                const existing = next[cid] || [];
                const existingIndex = existing.findIndex(ex => ex.id === m.id);

                if (existingIndex === -1) {
                    // New message
                    const updated = [...existing, m].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                    next[cid] = updated;
                    hasChanged = true;
                } else {
                    // Update if status or content or reactions changed
                    const existingMsg = existing[existingIndex];
                    if (
                        existingMsg.status !== m.status ||
                        existingMsg.content !== m.content ||
                        JSON.stringify(existingMsg.reactions) !== JSON.stringify(m.reactions)
                    ) {
                        const updated = [...existing];
                        updated[existingIndex] = m;
                        next[cid] = updated;
                        hasChanged = true;
                    }
                }
            });

            return hasChanged ? next : prev;
        });
    }, [dmMessages, setMessagesByConversationId]);
}
