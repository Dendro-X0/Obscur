"use client";

import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useThreadMessages } from "../../messaging/hooks/use-thread-messages";
import { usePinnedDmForMessageHook } from "./use-pinned-dm-for-message-hook";
import { isPreviewableMediaAttachment } from "../../messaging/utils/logic";
import type {
    Conversation,
    Message,
    MediaItem
} from "../../messaging/types";

interface UseChatViewPropsParams {
    selectedConversation: Conversation | null;
    myPublicKeyHex: string | null;
}

/**
 * Hook to compute and manage properties for the ChatView component.
 * Unified DM + group thread display via useThreadMessages (group stub until v2 backend).
 */
export function useChatViewProps({
    selectedConversation,
    myPublicKeyHex
}: UseChatViewPropsParams) {
    const { t } = useTranslation();

    const pinnedDm = usePinnedDmForMessageHook(selectedConversation);
    const pinnedDmConversationId = selectedConversation?.kind === "group"
        ? pinnedDm?.id
        : undefined;

    const {
        messages,
        isLoading,
        hasEarlier,
        loadEarlier,
        pendingEventCount,
        hasHydrated,
    } = useThreadMessages(selectedConversation, myPublicKeyHex, {
        pinnedDmConversationId,
    });

    const handleLoadEarlier = useCallback(() => {
        loadEarlier();
    }, [loadEarlier]);

    const handleCopyMyPubkey = useCallback(() => {
        if (myPublicKeyHex) {
            navigator.clipboard.writeText(myPublicKeyHex);
            toast.success(t("settings.pubkeyCopied"));
        }
    }, [myPublicKeyHex, t]);

    const handleCopyChatLink = useCallback(() => {
        if (myPublicKeyHex) {
            const link = `https://obscur.app/invites?pubkey=${myPublicKeyHex}`;
            navigator.clipboard.writeText(link);
            toast.success(t("messaging.chatLinkCopied"));
        }
    }, [myPublicKeyHex, t]);

    const selectedConversationMediaItems = useMemo((): MediaItem[] => {
        const items: MediaItem[] = [];
        messages.forEach(m => {
            if (m.attachments) {
                m.attachments.forEach(a => {
                    if (isPreviewableMediaAttachment(a)) {
                        items.push({
                            attachment: a,
                            messageId: m.id,
                            timestamp: m.timestamp
                        });
                    }
                });
            }
        });
        return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [messages]);

    return {
        handleLoadEarlier,
        handleCopyMyPubkey,
        handleCopyChatLink,
        conversationHasHydrated: hasHydrated,
        visibleMessages: messages,
        rawMessagesCount: messages.length,
        hasEarlierMessages: hasEarlier,
        selectedConversationMediaItems,
        isLoading,
        pendingEventCount
    };
}
