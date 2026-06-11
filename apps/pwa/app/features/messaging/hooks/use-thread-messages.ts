"use client";

import type { Conversation, Message } from "../types";
import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import { useDmKernelThread } from "@/app/features/dm-kernel/use-dm-kernel-thread";
import { useConversationMessages } from "./use-conversation-messages";
import { useGroupThreadMessages } from "./use-group-thread-messages";

export interface UseThreadMessagesResult {
    messages: ReadonlyArray<Message>;
    isLoading: boolean;
    hasEarlier: boolean;
    loadEarlier: () => Promise<void>;
    pendingEventCount: number;
    hasHydrated: boolean;
}

export interface UseThreadMessagesOptions {
    /** Keeps DM hydration on last opened DM while viewing a group (radical ownership split). */
    pinnedDmConversationId?: string;
}

/**
 * Canonical thread message hook for ChatView — DM delegates to useConversationMessages;
 * group threads read SQLite via useGroupThreadMessages (write/repair plugs in at append owner).
 */
export function useThreadMessages(
    selectedConversation: Conversation | null | undefined,
    publicKeyHex: string | null,
    options?: UseThreadMessagesOptions,
): UseThreadMessagesResult {
    const kernel = isDmKernelAuthority();
    const isDm = selectedConversation?.kind === "dm";
    const isGroup = selectedConversation?.kind === "group";

    const displayDmId = isDm ? selectedConversation.id : undefined;
    const backgroundDmId = isGroup ? options?.pinnedDmConversationId : undefined;

    const displayDmKernel = useDmKernelThread(kernel ? displayDmId : undefined, publicKeyHex);
    useDmKernelThread(kernel ? backgroundDmId : undefined, publicKeyHex);

    const displayDmLegacy = useConversationMessages(kernel ? undefined : displayDmId, publicKeyHex);
    useConversationMessages(kernel ? undefined : backgroundDmId, publicKeyHex);

    const groupThread = useGroupThreadMessages(
        isGroup ? selectedConversation : null,
        publicKeyHex,
    );

    if (isGroup) {
        return groupThread;
    }

    const displayDm = kernel ? displayDmKernel : displayDmLegacy;

    return {
        messages: displayDm.messages,
        isLoading: displayDm.isLoading,
        hasEarlier: displayDm.hasEarlier,
        loadEarlier: displayDm.loadEarlier,
        pendingEventCount: displayDm.pendingEventCount,
        hasHydrated: kernel ? displayDmKernel.hasHydrated : !displayDmLegacy.isLoading,
    };
}
