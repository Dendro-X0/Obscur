"use client";

import { useCallback } from "react";
import type { Message } from "../types";

const EMPTY_MESSAGES: ReadonlyArray<Message> = [];

const noopLoadEarlier = async (): Promise<void> => undefined;

export interface UseInertConversationMessagesResult {
    messages: ReadonlyArray<Message>;
    isLoading: boolean;
    hasEarlier: boolean;
    loadEarlier: () => Promise<void>;
    pendingEventCount: number;
}

/**
 * Strict engine-lab stub — no hydrate loops. Web DM threads stay empty unless
 * `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1` routes through legacy hook.
 */
export function useInertConversationMessages(
    conversationId: string | undefined,
    _publicKeyHex: string | null,
): UseInertConversationMessagesResult {
    void conversationId;
    const loadEarlier = useCallback(noopLoadEarlier, []);
    return {
        messages: EMPTY_MESSAGES,
        isLoading: false,
        hasEarlier: false,
        loadEarlier,
        pendingEventCount: 0,
    };
}
