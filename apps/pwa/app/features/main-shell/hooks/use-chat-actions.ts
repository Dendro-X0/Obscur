"use client";

import { useCallback } from "react";
import { toast } from "@/app/components/ui/toast";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { createEmptyReactions, toReactionsByEmoji } from "@/app/features/messaging/utils/logic";
import type { Message, ReactionEmoji } from "@/app/features/messaging/types";
import type { UseEnhancedDMControllerResult } from "../../messaging/controllers/enhanced-dm-controller";
import { GroupService } from "@/app/features/groups/services/group-service";

/**
 * Hook to manage chat actions like sending, deleting, and reacting to messages.
 */
export function useChatActions(dmController: UseEnhancedDMControllerResult | null) {
    const {
        selectedConversation,
        messageInput, setMessageInput,
        replyTo, setReplyTo,
        setMessagesByConversationId,
        pendingAttachments, setPendingAttachments,
        setPendingAttachmentPreviewUrls,
        setContactOverridesByContactId
    } = useMessaging();
    const identity = useIdentity();

    const handleSendMessage = useCallback(async () => {
        if (!selectedConversation || (!messageInput.trim() && pendingAttachments.length === 0)) return;

        const currentInput = messageInput;
        const currentReplyTo = replyTo;
        const conversationId = selectedConversation.id;

        // Optimistically clear input
        setMessageInput("");
        setPendingAttachments([]);
        setPendingAttachmentPreviewUrls([]);
        setReplyTo(null);

        try {
            if (selectedConversation.kind === 'dm') {
                if (!dmController) {
                    throw new Error("DM controller not initialized");
                }

                await dmController.sendDm({
                    peerPublicKeyInput: selectedConversation.pubkey,
                    plaintext: currentInput,
                    replyTo: currentReplyTo?.messageId
                });

                // Update contact overrides to show last message in sidebar
                setContactOverridesByContactId(prev => ({
                    ...prev,
                    [conversationId]: {
                        lastMessage: currentInput.slice(0, 100),
                        lastMessageTime: new Date()
                    }
                }));

            } else if (selectedConversation.kind === 'group') {
                if (!identity.state.publicKeyHex || !identity.state.privateKeyHex) {
                    throw new Error("Identity not unlocked");
                }

                const groupService = new GroupService(
                    identity.state.publicKeyHex,
                    identity.state.privateKeyHex
                );

                const event = await groupService.sendMessage({
                    groupId: selectedConversation.groupId,
                    content: currentInput,
                    replyTo: currentReplyTo?.messageId
                });

                // Optimistic UI for Groups
                const optimisticMessage: Message = {
                    id: event.id,
                    kind: 'user',
                    content: currentInput,
                    timestamp: new Date(),
                    isOutgoing: true,
                    status: 'sending',
                    eventId: event.id,
                    senderPubkey: identity.state.publicKeyHex,
                    reactions: createEmptyReactions(),
                    replyTo: currentReplyTo ? {
                        messageId: currentReplyTo.messageId,
                        previewText: currentReplyTo.previewText
                    } : undefined,
                    attachments: [] // Attachments logic to be expanded
                };

                setMessagesByConversationId(prev => ({
                    ...prev,
                    [conversationId]: [...(prev[conversationId] ?? []), optimisticMessage]
                }));
            }
        } catch (error: any) {
            console.error("Failed to send message:", error);
            toast.error("Failed to send message");
            setMessageInput(currentInput);
        }
    }, [
        selectedConversation,
        messageInput,
        pendingAttachments,
        replyTo,
        dmController,
        identity.state.publicKeyHex,
        identity.state.privateKeyHex,
        setMessageInput,
        setPendingAttachments,
        setPendingAttachmentPreviewUrls,
        setReplyTo,
        setContactOverridesByContactId,
        setMessagesByConversationId
    ]);

    const deleteMessage = useCallback(async (params: { conversationId: string; messageId: string }) => {
        setMessagesByConversationId(prev => {
            const next = { ...prev };
            if (next[params.conversationId]) {
                next[params.conversationId] = next[params.conversationId].filter(m => m.id !== params.messageId);
            }
            return next;
        });
        // Note: Actual Nostr deletion (Kind 5) could be added here
    }, [setMessagesByConversationId]);

    const toggleReaction = useCallback(async (params: { conversationId: string; messageId: string; emoji: string }) => {
        const reactionEmoji = params.emoji as ReactionEmoji;

        setMessagesByConversationId(prev => {
            const next = { ...prev };
            if (next[params.conversationId]) {
                next[params.conversationId] = next[params.conversationId].map(m => {
                    if (m.id === params.messageId) {
                        const reactions = { ...(m.reactions || createEmptyReactions()) } as Record<ReactionEmoji, number>;
                        const current = reactions[reactionEmoji] || 0;
                        reactions[reactionEmoji] = current > 0 ? current - 1 : current + 1;
                        return { ...m, reactions: toReactionsByEmoji(reactions) };
                    }
                    return m;
                });
            }
            return next;
        });

        // Note: Actual Nostr reaction (Kind 7) could be added here
    }, [setMessagesByConversationId]);

    return { handleSendMessage, deleteMessage, toggleReaction };
}
