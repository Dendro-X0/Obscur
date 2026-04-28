"use client";

import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
// Using fixed hook with diagnostics to track outgoing vs incoming messages
import { useConversationMessagesFixed as useConversationMessages } from "../../messaging/hooks/use-conversation-messages-fixed";
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
 * Now internally uses useConversationMessages for high-performance localized state.
 */
export function useChatViewProps({
    selectedConversation,
    myPublicKeyHex
}: UseChatViewPropsParams) {
    const { t } = useTranslation();

    const {
        messages,
        isLoading,
        hasEarlier,
        loadEarlier,
        pendingEventCount
    } = useConversationMessages(selectedConversation?.id || undefined, myPublicKeyHex);

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
        conversationHasHydrated: !isLoading,
        visibleMessages: messages,
        rawMessagesCount: messages.length,
        hasEarlierMessages: hasEarlier,
        selectedConversationMediaItems,
        isLoading,
        pendingEventCount
    };
}
