"use client";

import { useEffect, useRef } from "react";
import type { Message, MessagesByConversationId } from "@/app/features/messaging/types";

export function useCommandMessages(
    messages: ReadonlyArray<Message>,
    setMessagesByConversationId: React.Dispatch<React.SetStateAction<MessagesByConversationId>>
) {
    const handledAcceptedRef = useRef<Set<string>>(new Set());
    const handledRejectedRef = useRef<Set<string>>(new Set());

    // Handle Accepted DMs
    useEffect(() => {
        const accepted = messages
            .filter(m => m.isOutgoing && m.status === "accepted" && !handledAcceptedRef.current.has(m.id));

        if (accepted.length === 0) return;

        accepted.forEach(m => handledAcceptedRef.current.add(m.id));
        const acceptedIds = new Set(accepted.map(m => m.id));

        setMessagesByConversationId(prev => {
            const next: Record<string, ReadonlyArray<Message>> = { ...prev };
            Object.entries(prev).forEach(([conversationId, msgs]) => {
                next[conversationId] = msgs.map(msg =>
                    acceptedIds.has(msg.id) && msg.status !== "accepted" ? { ...msg, status: "accepted" } : msg
                );
            });
            return next as MessagesByConversationId;
        });
    }, [messages, setMessagesByConversationId]);

    // Handle Rejected DMs
    useEffect(() => {
        const rejected = messages
            .filter(m => m.isOutgoing && m.status === "rejected" && !handledRejectedRef.current.has(m.id));

        if (rejected.length === 0) return;

        rejected.forEach(m => handledRejectedRef.current.add(m.id));
        const rejectedIds = new Set(rejected.map(m => m.id));

        setMessagesByConversationId(prev => {
            const next: Record<string, ReadonlyArray<Message>> = { ...prev };
            Object.entries(prev).forEach(([conversationId, msgs]) => {
                next[conversationId] = msgs.map(msg =>
                    rejectedIds.has(msg.id) && msg.status !== "rejected" ? { ...msg, status: "rejected" } : msg
                );
            });
            return next as MessagesByConversationId;
        });
    }, [messages, setMessagesByConversationId]);
}
