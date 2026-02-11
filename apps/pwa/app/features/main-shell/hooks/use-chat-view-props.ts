"use client";

import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/app/components/ui/toast";
import type {
    Conversation,
    Message,
    MessagesByConversationId,
    MediaItem,
    Attachment
} from "../../messaging/types";

interface UseChatViewPropsParams {
    selectedConversation: Conversation | null;
    messagesByConversationId: MessagesByConversationId;
    visibleMessageCountByConversationId: Readonly<Record<string, number>>;
    setVisibleMessageCountByConversationId: React.Dispatch<React.SetStateAction<Readonly<Record<string, number>>>>;
    myPublicKeyHex: string | null;
    DEFAULT_VISIBLE_MESSAGES: number;
    LOAD_EARLIER_STEP: number;
}

/**
 * Hook to compute and manage properties for the ChatView component.
 */
export function useChatViewProps({
    selectedConversation,
    messagesByConversationId,
    visibleMessageCountByConversationId,
    setVisibleMessageCountByConversationId,
    myPublicKeyHex,
    DEFAULT_VISIBLE_MESSAGES,
    LOAD_EARLIER_STEP
}: UseChatViewPropsParams) {
    const { t } = useTranslation();

    const handleLoadEarlier = useCallback(() => {
        if (!selectedConversation) return;
        setVisibleMessageCountByConversationId(prev => ({
            ...prev,
            [selectedConversation.id]: (prev[selectedConversation.id] ?? DEFAULT_VISIBLE_MESSAGES) + LOAD_EARLIER_STEP
        }));
    }, [selectedConversation, setVisibleMessageCountByConversationId, DEFAULT_VISIBLE_MESSAGES, LOAD_EARLIER_STEP]);

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

    const selectedConversationMessages = useMemo(() => {
        if (!selectedConversation) return [];
        return messagesByConversationId[selectedConversation.id] ?? [];
    }, [selectedConversation, messagesByConversationId]);

    const visibleCount = selectedConversation ? (visibleMessageCountByConversationId[selectedConversation.id] ?? DEFAULT_VISIBLE_MESSAGES) : DEFAULT_VISIBLE_MESSAGES;
    const visibleMessages = useMemo(() => {
        return selectedConversationMessages.slice(-visibleCount);
    }, [selectedConversationMessages, visibleCount]);

    const hasEarlierMessages = selectedConversationMessages.length > visibleCount;

    const selectedConversationMediaItems = useMemo((): MediaItem[] => {
        const items: MediaItem[] = [];
        selectedConversationMessages.forEach(m => {
            if (m.attachments) {
                m.attachments.forEach(a => {
                    if (a.kind === 'image' || a.kind === 'video') {
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
    }, [selectedConversationMessages]);

    return {
        handleLoadEarlier,
        handleCopyMyPubkey,
        handleCopyChatLink,
        visibleMessages,
        rawMessagesCount: selectedConversationMessages.length,
        hasEarlierMessages,
        selectedConversationMediaItems
    };
}
