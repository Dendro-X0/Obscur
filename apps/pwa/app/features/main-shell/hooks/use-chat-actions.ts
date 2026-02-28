"use client";

import { useCallback } from "react";
import { toast } from "@dweb/ui-kit";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { createEmptyReactions, toReactionsByEmoji } from "@/app/features/messaging/utils/logic";
import { type Message, type ReactionEmoji, UploadError, UploadErrorCode } from "@/app/features/messaging/types";
import type { UseEnhancedDMControllerResult } from "../../messaging/controllers/enhanced-dm-controller";
import { GroupService } from "@/app/features/groups/services/group-service";
import { useUploadService } from "../../messaging/lib/upload-service";
import { messageBus } from "../../messaging/services/message-bus";

/**
 * Hook to manage chat actions like sending, deleting, and reacting to messages.
 */
export function useChatActions(dmController: UseEnhancedDMControllerResult | null) {
    const {
        selectedConversation,
        messageInput, setMessageInput,
        replyTo, setReplyTo,
        pendingAttachments, setPendingAttachments,
        setPendingAttachmentPreviewUrls,
        setContactOverridesByContactId,
        setIsUploadingAttachment,
        setAttachmentError
    } = useMessaging();
    const identity = useIdentity();
    const uploadService = useUploadService();
    const { peerTrust, requestsInbox } = useNetwork();

    const handleSendMessage = useCallback(async () => {
        if (!selectedConversation || (!messageInput.trim() && pendingAttachments.length === 0)) return;

        // 1. Upload Attachments if any
        let finalContent = messageInput;
        const attachments = [];

        if (pendingAttachments.length > 0) {
            setIsUploadingAttachment(true);
            setAttachmentError(null);

            try {
                // Upload all files in parallel
                const results = await Promise.all(pendingAttachments.map(file => uploadService.uploadFile(file)));
                attachments.push(...results);

                // Append URLs to content (NIP-96 standard behavior for clients)
                const urls = attachments.map(a => a.url).join(" ");
                if (finalContent.trim()) {
                    finalContent += "\n" + urls;
                } else {
                    finalContent = urls;
                }
            } catch (error: any) {
                console.error("Failed to upload attachment:", error);
                setIsUploadingAttachment(false);

                if (error instanceof UploadError) {
                    switch (error.code) {
                        case UploadErrorCode.NO_SESSION:
                            setAttachmentError("Session expired. Please lock/unlock.");
                            break;
                        case UploadErrorCode.AUTH_MISSING_KEY:
                            setAttachmentError("Login required for upload.");
                            break;
                        case UploadErrorCode.FILE_TOO_LARGE:
                            setAttachmentError("File too large.");
                            break;
                        case UploadErrorCode.NETWORK_ERROR:
                            setAttachmentError("Network error. Check connection.");
                            break;
                        default:
                            setAttachmentError(error.message || "Upload failed");
                    }
                } else {
                    setAttachmentError("Upload failed unexpectedly");
                }
                return; // Stop sending
            }
        }

        // 2. Prepare for Send
        const currentInput = finalContent;
        const currentReplyTo = replyTo;
        const conversationId = selectedConversation.id;

        // Optimistically clear input
        setMessageInput("");
        setPendingAttachments([]);
        setPendingAttachmentPreviewUrls([]);
        setReplyTo(null);
        setIsUploadingAttachment(false); // Done uploading

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

                const rs = requestsInbox.getRequestStatus({ peerPublicKeyHex: selectedConversation.pubkey });
                const isOutgoingPending = !!(rs?.isOutgoing && (rs.status === 'pending' || !rs.status));
                if (!isOutgoingPending) {
                    // Auto-accept the peer since we are initiating/responding consciously
                    peerTrust.acceptPeer({ publicKeyHex: selectedConversation.pubkey });
                }

                // Update contact overrides to show last message in sidebar
                setContactOverridesByContactId(prev => ({
                    ...prev,
                    [conversationId]: {
                        lastMessage: currentInput.slice(0, 100),
                        lastMessageTime: new Date()
                    }
                }));

                // Decoupled: useDmSync will emit the message once it hits the dmController state
            } else if (selectedConversation.kind === 'group') {
                if (!identity.state.publicKeyHex || !identity.state.privateKeyHex) {
                    throw new Error("Identity not unlocked");
                }

                const groupService = new GroupService(
                    identity.state.publicKeyHex,
                    identity.state.privateKeyHex
                );

                const event = await groupService.sendSealedMessage({
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
                    attachments: attachments // Now we have actual attachments!
                };

                // Emit optimistic message to MessageBus
                messageBus.emitNewMessage(conversationId, optimisticMessage);
            }
        } catch (error: any) {
            console.error("Failed to send message:", error);
            toast.error("Failed to send message");
            // Restore input on failure
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
        setIsUploadingAttachment,
        setAttachmentError,
        uploadService,
        peerTrust
    ]);

    const deleteMessage = useCallback(async (params: { conversationId: string; messageId: string }) => {
        // Emit deletion to MessageBus
        messageBus.emit({ type: 'message_deleted', conversationId: params.conversationId, messageId: params.messageId });

        if (selectedConversation?.kind === 'group') {
            try {
                if (identity.state.publicKeyHex && identity.state.privateKeyHex) {
                    const groupService = new GroupService(identity.state.publicKeyHex, identity.state.privateKeyHex);
                    await groupService.hideMessage({
                        groupId: selectedConversation.groupId,
                        eventId: params.messageId
                    });
                }
            } catch (error) {
                console.error("Failed to delete group message:", error);
            }
        }
    }, [selectedConversation, identity.state]);

    const toggleReaction = useCallback(async (params: { conversationId: string; message: Message; emoji: string }) => {
        const reactionEmoji = params.emoji as ReactionEmoji;
        const msg = params.message;

        // Optimistic update for the bus
        const reactions = { ...(msg.reactions || createEmptyReactions()) } as Record<ReactionEmoji, number>;
        const current = reactions[reactionEmoji] || 0;
        reactions[reactionEmoji] = current > 0 ? current - 1 : current + 1;
        const updatedMsg = { ...msg, reactions: toReactionsByEmoji(reactions) };

        // Emit update to MessageBus (for reactions)
        messageBus.emitMessageUpdated(params.conversationId, updatedMsg);

        if (selectedConversation?.kind === 'group') {
            try {
                if (identity.state.publicKeyHex && identity.state.privateKeyHex) {
                    const groupService = new GroupService(identity.state.publicKeyHex, identity.state.privateKeyHex);
                    await groupService.sendSealedReaction({
                        groupId: selectedConversation.groupId,
                        eventId: msg.id,
                        emoji: params.emoji
                    });
                }
            } catch (error) {
                console.error("Failed to send group reaction:", error);
            }
        }
    }, [selectedConversation, identity.state]);

    return { handleSendMessage, deleteMessage, toggleReaction };
}
