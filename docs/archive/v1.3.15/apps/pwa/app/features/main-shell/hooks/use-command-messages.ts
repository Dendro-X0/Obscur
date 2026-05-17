"use client";

import { useEffect, useRef } from "react";
import type { Message, MessagesByConversationId } from "@/app/features/messaging/types";

import { messageBus } from "@/app/features/messaging/services/message-bus";

export function useCommandMessages(
    messages: ReadonlyArray<Message>
) {
    const handledAcceptedRef = useRef<Set<string>>(new Set());
    const handledRejectedRef = useRef<Set<string>>(new Set());

    // Handle Accepted DMs
    useEffect(() => {
        const accepted = messages
            .filter(m => m.isOutgoing && m.status === "accepted" && !handledAcceptedRef.current.has(m.id));

        if (accepted.length === 0) return;

        accepted.forEach(m => {
            handledAcceptedRef.current.add(m.id);
            if (m.conversationId) {
                messageBus.emitMessageUpdated(m.conversationId, m);
            }
        });
    }, [messages]);

    // Handle Rejected DMs
    useEffect(() => {
        const rejected = messages
            .filter(m => m.isOutgoing && m.status === "rejected" && !handledRejectedRef.current.has(m.id));

        if (rejected.length === 0) return;

        rejected.forEach(m => {
            handledRejectedRef.current.add(m.id);
            if (m.conversationId) {
                messageBus.emitMessageUpdated(m.conversationId, m);
            }
        });
    }, [messages]);
}
