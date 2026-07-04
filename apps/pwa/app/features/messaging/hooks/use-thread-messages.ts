"use client";

import type { Conversation, Message } from "../types";
import type { InviteResponseStatus } from "../components/message-list-render-meta";
import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import { useDmKernelThread } from "@/app/features/dm-kernel/use-dm-kernel-thread";
import {
  shouldUseLegacyConversationMessagesHydrate,
  useLegacyConversationMessages,
} from "./conversation-messages-legacy-port";
import { useInertConversationMessages } from "./use-inert-conversation-messages";
import { useGroupThreadMessages } from "./use-group-thread-messages";

export interface UseThreadMessagesResult {
    messages: ReadonlyArray<Message>;
    inviteResponseStatusByMessageId?: ReadonlyMap<string, InviteResponseStatus>;
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
 * Canonical thread message hook for ChatView — native DM via dm-kernel;
 * web strict mode uses inert stub; legacy hydrate opt-in via OBSCUR_ALLOW_LEGACY=1.
 */
export function useThreadMessages(
    selectedConversation: Conversation | null | undefined,
    publicKeyHex: string | null,
    options?: UseThreadMessagesOptions,
): UseThreadMessagesResult {
    const kernel = isDmKernelAuthority();
    const legacyHydrate = shouldUseLegacyConversationMessagesHydrate();
    const isDm = selectedConversation?.kind === "dm";
    const isGroup = selectedConversation?.kind === "group";

    const displayDmId = isDm ? selectedConversation.id : undefined;
    const backgroundDmId = isGroup ? options?.pinnedDmConversationId : undefined;

    const displayDmKernel = useDmKernelThread(kernel ? displayDmId : undefined, publicKeyHex);
    useDmKernelThread(kernel ? backgroundDmId : undefined, publicKeyHex);

    const displayDmLegacy = useLegacyConversationMessages(
        legacyHydrate ? displayDmId : undefined,
        publicKeyHex,
    );
    useLegacyConversationMessages(
        legacyHydrate ? backgroundDmId : undefined,
        publicKeyHex,
    );

    const displayDmInert = useInertConversationMessages(
        !kernel && !legacyHydrate ? displayDmId : undefined,
        publicKeyHex,
    );
    useInertConversationMessages(
        !kernel && !legacyHydrate ? backgroundDmId : undefined,
        publicKeyHex,
    );

    const groupThread = useGroupThreadMessages(
        isGroup ? selectedConversation : null,
        publicKeyHex,
    );

    if (isGroup) {
        return groupThread;
    }

    const displayDm = kernel
        ? displayDmKernel
        : (legacyHydrate ? displayDmLegacy : displayDmInert);

    return {
        messages: displayDm.messages,
        inviteResponseStatusByMessageId: kernel
            ? displayDmKernel.inviteResponseStatusByMessageId
            : undefined,
        isLoading: displayDm.isLoading,
        hasEarlier: displayDm.hasEarlier,
        loadEarlier: displayDm.loadEarlier,
        pendingEventCount: displayDm.pendingEventCount,
        hasHydrated: kernel
            ? displayDmKernel.hasHydrated
            : (legacyHydrate ? !displayDmLegacy.isLoading : true),
    };
}
