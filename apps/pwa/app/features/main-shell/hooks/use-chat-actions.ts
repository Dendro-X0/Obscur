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
import { chatStateStoreService } from "../../messaging/services/chat-state-store";
import {
    BEST_EFFORT_STORAGE_NOTE,
    shouldAvoidInMemoryAttachmentCaching,
} from "../../messaging/lib/media-upload-policy";
import { cacheAttachmentLocally } from "../../vault/services/local-media-store";
import { shouldCacheAttachmentInVault } from "../../messaging/utils/attachment-storage-policy";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { logAppEvent } from "@/app/shared/log-app-event";
import { normalizeRelayUrl as normalizeRelayUrlBase } from "@dweb/nostr/relay-utils";
import { createDeleteCommandMessage, encodeCommandMessage } from "../../messaging/utils/commands";
import { suppressMessageDeleteTombstone } from "../../messaging/services/message-delete-tombstone-store";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import { canDeleteMessageForEveryone, getDeleteForEveryoneRejectionReason } from "../../messaging/services/message-delete-permissions";
import { appendCanonicalDmRemovedEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";

type MultiRelayPublishResult = Readonly<{
    success: boolean;
    successCount: number;
    totalRelays: number;
    results: ReadonlyArray<Readonly<{ success: boolean; relayUrl: string; error?: string; latency?: number }>>;
    overallError?: string;
}>;

const UNKNOWN_RELAY_SENTINELS = new Set(["unknown", "null", "undefined", "n/a", "none"]);

const toIdHint = (value: string | null | undefined): string | null => {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized.length === 0) {
        return null;
    }
    if (normalized.length <= 16) {
        return normalized;
    }
    return `${normalized.slice(0, 8)}...${normalized.slice(-8)}`;
};

const toLocalDeleteIdentityIds = (message: Message): ReadonlyArray<string> => {
    const ids = new Set<string>();
    const messageId = message.id.trim();
    const eventId = message.eventId?.trim() ?? "";
    if (messageId.length > 0) {
        ids.add(messageId);
    }
    if (eventId.length > 0) {
        ids.add(eventId);
    }
    return Array.from(ids);
};

const fallbackDigestHex = (payload: string): string => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < payload.length; i += 1) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0").repeat(8);
};

const deriveNip17RumorId = async (params: Readonly<{
    senderPubkey: string;
    recipientPubkey: string;
    plaintext: string;
    createdAtUnixSeconds: number;
    replyToMessageId?: string | null;
}>): Promise<string> => {
    const tags: string[][] = [["p", params.recipientPubkey]];
    const replyToMessageId = params.replyToMessageId?.trim();
    if (replyToMessageId) {
        tags.push(["e", replyToMessageId, "", "reply"]);
    }
    const payload = JSON.stringify([
        0,
        params.senderPubkey,
        params.createdAtUnixSeconds,
        14,
        tags,
        params.plaintext,
    ]);
    try {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    } catch {
        return fallbackDigestHex(payload);
    }
};

const buildAttachmentMarkdown = (attachments: Message["attachments"]): string => {
    if (!Array.isArray(attachments) || attachments.length === 0) {
        return "";
    }
    return attachments
        .map((attachment) => {
            const fileName = typeof attachment?.fileName === "string" ? attachment.fileName.trim() : "";
            const url = typeof attachment?.url === "string" ? attachment.url.trim() : "";
            if (!fileName || !url) {
                return "";
            }
            return `[${fileName}](${url})`;
        })
        .filter((value) => value.length > 0)
        .join(" ");
};

const buildDeletePlaintextCandidates = (message: Message): ReadonlyArray<string> => {
    const candidates = new Set<string>();
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (content.length > 0) {
        candidates.add(content);
    }
    const attachmentMarkdown = buildAttachmentMarkdown(message.attachments);
    if (attachmentMarkdown.length > 0) {
        candidates.add(attachmentMarkdown);
        if (content.length > 0 && !content.includes(attachmentMarkdown)) {
            candidates.add(`${content}\n\n${attachmentMarkdown}`.trim());
            candidates.add(`${content} ${attachmentMarkdown}`.trim());
        }
    }
    return Array.from(candidates);
};

const buildDeleteCreatedAtCandidates = (message: Message): ReadonlyArray<number> => {
    const candidates = new Set<number>();
    const pushDate = (value: Date | undefined) => {
        if (!(value instanceof Date)) {
            return;
        }
        const unixSeconds = Math.floor(value.getTime() / 1000);
        if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
            candidates.add(unixSeconds);
        }
    };
    pushDate(message.eventCreatedAt);
    pushDate(message.timestamp);
    return Array.from(candidates);
};

const buildDeleteTargetIdsForDm = async (params: Readonly<{
    message: Message;
    senderPubkey: string | null;
    recipientPubkey: string | null;
}>): Promise<ReadonlyArray<string>> => {
    const deleteTargetIds = new Set<string>();
    const eventId = params.message.eventId?.trim();
    if (eventId && eventId.length > 0) {
        deleteTargetIds.add(eventId);
    }
    const directMessageId = params.message.id.trim();
    if (directMessageId.length > 0) {
        deleteTargetIds.add(directMessageId);
    }

    if (!params.senderPubkey || !params.recipientPubkey) {
        return Array.from(deleteTargetIds);
    }

    const plaintextCandidates = buildDeletePlaintextCandidates(params.message);
    const createdAtCandidates = buildDeleteCreatedAtCandidates(params.message);
    const replyToMessageId = params.message.replyTo?.messageId?.trim();
    const replyCandidates = replyToMessageId
        ? [replyToMessageId, null]
        : [null];

    for (const plaintext of plaintextCandidates) {
        if (plaintext.length === 0) {
            continue;
        }
        for (const createdAtUnixSeconds of createdAtCandidates) {
            for (const replyCandidate of replyCandidates) {
                const rumorId = await deriveNip17RumorId({
                    senderPubkey: params.senderPubkey,
                    recipientPubkey: params.recipientPubkey,
                    plaintext,
                    createdAtUnixSeconds,
                    replyToMessageId: replyCandidate,
                });
                const normalizedRumorId = rumorId.trim();
                if (normalizedRumorId.length > 0) {
                    deleteTargetIds.add(normalizedRumorId);
                }
            }
        }
    }

    return Array.from(deleteTargetIds);
};

const toScopedRelayUrl = (relayUrl: string): string | null => {
    const normalized = normalizeRelayUrlBase(relayUrl);
    const trimmed = /^[a-z]+:\/\/$/i.test(normalized) ? normalized : normalized.replace(/\/+$/g, "");
    if (trimmed.length === 0 || UNKNOWN_RELAY_SENTINELS.has(trimmed)) return null;
    return /^wss?:\/\/.+/.test(trimmed) ? trimmed : null;
};

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
        setConnectionOverridesByConnectionId,
        setIsUploadingAttachment,
        setUploadStage,
        setAttachmentError
    } = useMessaging();
    const identity = useIdentity();
    const uploadService = useUploadService();
    const { peerTrust, requestsInbox } = useNetwork();
    const { relayPool } = useRelay();
    const recipientMetadata = useResolvedProfileMetadata(
        selectedConversation?.kind === "dm" ? selectedConversation.pubkey : null,
        { live: false }
    );
    const isDeletedRecipient = selectedConversation?.kind === "dm" && recipientMetadata.isDeleted;

    const publishGroupEvent = useCallback(async (params: Readonly<{ relayUrl: string; event: Readonly<{ id: string }> }>): Promise<void> => {
        const payload = JSON.stringify(["EVENT", params.event]);
        const scopedRelayUrl = toScopedRelayUrl(params.relayUrl);
        let result: MultiRelayPublishResult;

        if (scopedRelayUrl && typeof relayPool.publishToUrls === "function") {
            result = await relayPool.publishToUrls([scopedRelayUrl], payload);
        } else if (scopedRelayUrl && typeof relayPool.publishToUrl === "function") {
            const single = await relayPool.publishToUrl(scopedRelayUrl, payload);
            result = {
                success: single.success,
                successCount: single.success ? 1 : 0,
                totalRelays: 1,
                results: [single],
                overallError: single.success ? undefined : (single.error ?? "Scoped publish failed"),
            };
        } else if (scopedRelayUrl && typeof relayPool.publishToRelay === "function") {
            const single = await relayPool.publishToRelay(scopedRelayUrl, payload);
            result = {
                success: single.success,
                successCount: single.success ? 1 : 0,
                totalRelays: 1,
                results: [single],
                overallError: single.success ? undefined : (single.error ?? "Scoped publish failed"),
            };
        } else {
            result = await relayPool.publishToAll(payload);
        }

        if (!result.success) {
            throw new Error(result.overallError || "Failed to publish group event to relay scope");
        }
    }, [relayPool]);

    const handleSendMessage = useCallback(async () => {
        if (!selectedConversation || (!messageInput.trim() && pendingAttachments.length === 0)) return;
        if (isDeletedRecipient) {
            toast.warning("This contact account has been removed. New messages cannot be delivered.");
            return;
        }

        // 1. Upload Attachments if any
        let finalContent = messageInput;
        const attachments = [];

        if (pendingAttachments.length > 0) {
            setIsUploadingAttachment(true);
            setUploadStage("encrypting");
            setAttachmentError(null);

            try {
                const uploadErrors: UploadError[] = [];
                setUploadStage("uploading");

                const fileBytesMap = new Map<string, Uint8Array>();

                // Upload sequentially to reduce provider rate-limit contention in dev mode.
                for (const file of pendingAttachments) {
                    try {
                        const uploaded = await uploadService.uploadFile(file);
                        attachments.push(uploaded);
                        if (!shouldAvoidInMemoryAttachmentCaching(file)) {
                            fileBytesMap.set(uploaded.url, new Uint8Array(await file.arrayBuffer()));
                        }
                    } catch (error) {
                        const uploadError = error instanceof UploadError
                            ? error
                            : new UploadError(UploadErrorCode.UNKNOWN, String(error));
                        uploadErrors.push(uploadError);
                    }
                }

                if (attachments.length === 0) {
                    throw uploadErrors[0] || new UploadError(UploadErrorCode.UNKNOWN, "All uploads failed");
                }
                if (uploadErrors.length > 0) {
                    toast.warning(`Uploaded ${attachments.length}/${pendingAttachments.length} files. Some files failed.`);
                }

                // Append URLs to content using markdown links to preserve the original filenames
                const urls = attachments.map(a => `[${a.fileName}](${a.url})`).join(" ");
                if (finalContent.trim()) {
                    finalContent += "\n\n" + urls;
                } else {
                    finalContent = urls;
                }

                // Do not block send path on local caching.
                const cacheableAttachments = attachments.filter((attachment) => shouldCacheAttachmentInVault(attachment));
                void Promise.all(
                    cacheableAttachments.map((attachment) => cacheAttachmentLocally(attachment, "sent", fileBytesMap.get(attachment.url)))
                ).catch((e) => {
                    console.warn("[Vault] Failed to cache sent attachments locally:", e);
                });
            } catch (error: any) {
                console.warn("Failed to upload attachment:", error);

                const errorMessage = error instanceof UploadError
                    ? (error.code === UploadErrorCode.NO_SESSION ? "Session expired. Please lock/unlock." :
                        error.code === UploadErrorCode.AUTH_MISSING_KEY ? "Login required for upload." :
                            error.code === UploadErrorCode.FILE_TOO_LARGE ? error.message :
                                error.code === UploadErrorCode.NETWORK_ERROR
                                    ? (error.message.toLowerCase().includes("timeout")
                                        ? `Upload timed out. Retry on a stable connection. ${BEST_EFFORT_STORAGE_NOTE}`
                                        : "Network error during upload. Check connection and retry.")
                                    :
                                    error.message || "Upload failed. Try another provider in Storage settings.")
                    : `Upload failed unexpectedly. Retry or switch provider in Storage settings. ${BEST_EFFORT_STORAGE_NOTE}`;

                setAttachmentError(errorMessage);
                toast.error(errorMessage);
                setUploadStage("idle");
                setIsUploadingAttachment(false);
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
        if (attachments.length > 0) {
            setUploadStage("sending");
        }

        try {
            if (selectedConversation.kind === 'dm') {
                if (!dmController) {
                    throw new Error("DM controller not initialized");
                }

                await dmController.sendDm({
                    peerPublicKeyInput: selectedConversation.pubkey,
                    plaintext: currentInput,
                    attachments,
                    replyTo: currentReplyTo?.messageId
                });

                const rs = requestsInbox.getRequestStatus({ peerPublicKeyHex: selectedConversation.pubkey });
                const isOutgoingPending = !!(rs?.isOutgoing && (rs.status === 'pending' || !rs.status));
                if (!isOutgoingPending) {
                    // Auto-accept the peer since we are initiating/responding consciously
                    peerTrust.acceptPeer({ publicKeyHex: selectedConversation.pubkey });
                }

                // Update connection overrides to show last message in sidebar
                setConnectionOverridesByConnectionId(prev => ({
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

                await publishGroupEvent({
                    relayUrl: selectedConversation.relayUrl,
                    event
                });

                // Emit local message after relay publish confirmation.
                const optimisticMessage: Message = {
                    id: event.id,
                    kind: 'user',
                    content: currentInput,
                    timestamp: new Date(),
                    isOutgoing: true,
                    status: 'delivered',
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
            setUploadStage("idle");
            setIsUploadingAttachment(false);
        } catch (error: any) {
            console.error("Failed to send message:", error);
            const fallback = selectedConversation?.kind === "group"
                ? "Failed to send group message. Check relay scope and retry."
                : "Failed to send message. Check relay connection and retry.";
            const detail = typeof error?.message === "string" && error.message.trim().length > 0
                ? error.message
                : fallback;
            toast.error(detail);
            // Restore input on failure
            setMessageInput(currentInput);
            setUploadStage("idle");
            setIsUploadingAttachment(false);
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
        setConnectionOverridesByConnectionId,
        setIsUploadingAttachment,
        setUploadStage,
        setAttachmentError,
        uploadService,
        peerTrust,
        requestsInbox,
        publishGroupEvent,
        isDeletedRecipient
    ]);

    const deleteMessageForMe = useCallback((params: { conversationId: string; message: Message }) => {
        const deleteIds = toLocalDeleteIdentityIds(params.message);
        if (identity.state.publicKeyHex) {
            chatStateStoreService.removeMessageIdentities(
                identity.state.publicKeyHex,
                params.conversationId,
                deleteIds,
            );
        }
        messageBus.emitMessageDeleted(params.conversationId, params.message.id, {
            messageIdentityIds: deleteIds,
        });
        if (identity.state.publicKeyHex) {
            deleteIds.forEach((messageId) => {
                void appendCanonicalDmRemovedEvent({
                    accountPublicKeyHex: identity.state.publicKeyHex!,
                    conversationId: params.conversationId,
                    messageId,
                    observedAtUnixMs: params.message.timestamp.getTime(),
                    idempotencySuffix: `local_delete_for_me:${messageId}`,
                    source: "legacy_bridge",
                });
            });
        }
    }, [identity.state.publicKeyHex]);

    const deleteMessageForEveryone = useCallback(async (params: { conversationId: string; message: Message }) => {
        if (!selectedConversation) {
            logAppEvent({
                name: "messaging.delete_for_everyone_rejected",
                level: "warn",
                scope: { feature: "messaging", action: "delete_message" },
                context: {
                    reasonCode: "no_selected_conversation",
                    conversationIdHint: toIdHint(params.conversationId),
                    messageIdHint: toIdHint(params.message.id),
                },
            });
            return;
        }

        const hasVoiceNoteAttachment = (
            Array.isArray(params.message.attachments)
            && params.message.attachments.some((attachment) => attachment.kind === "voice_note")
        );
        const baseContext = {
            conversationIdHint: toIdHint(params.conversationId),
            messageIdHint: toIdHint(params.message.id),
            messageEventIdHint: toIdHint(params.message.eventId ?? null),
            conversationKind: selectedConversation.kind,
            isOutgoing: params.message.isOutgoing,
            hasVoiceNoteAttachment,
        } as const;

        logAppEvent({
            name: "messaging.delete_for_everyone_requested",
            level: "info",
            scope: { feature: "messaging", action: "delete_message" },
            context: baseContext,
        });

        const deleteForEveryoneRejectionReason = getDeleteForEveryoneRejectionReason(params.message);
        if (deleteForEveryoneRejectionReason) {
            logAppEvent({
                name: "messaging.delete_for_everyone_rejected",
                level: "warn",
                scope: { feature: "messaging", action: "delete_message" },
                context: {
                    ...baseContext,
                    reasonCode: deleteForEveryoneRejectionReason,
                },
            });
            toast.info("You can only delete messages you sent.");
            return;
        }

        if (selectedConversation?.kind === 'group') {
            const localDeleteIds = toLocalDeleteIdentityIds(params.message);
            if (identity.state.publicKeyHex) {
                chatStateStoreService.removeMessageIdentities(
                    identity.state.publicKeyHex,
                    params.conversationId,
                    localDeleteIds,
                );
                localDeleteIds.forEach((messageId) => {
                    void appendCanonicalDmRemovedEvent({
                        accountPublicKeyHex: identity.state.publicKeyHex!,
                        conversationId: params.conversationId,
                        messageId,
                        observedAtUnixMs: params.message.timestamp.getTime(),
                        idempotencySuffix: `group_local_delete:${messageId}`,
                        source: "legacy_bridge",
                    });
                });
            }
            messageBus.emitMessageDeleted(params.conversationId, params.message.id, {
                messageIdentityIds: localDeleteIds,
            });
            logAppEvent({
                name: "messaging.delete_for_everyone_local_applied",
                level: "info",
                scope: { feature: "messaging", action: "delete_message" },
                context: {
                    ...baseContext,
                    deleteTargetCount: localDeleteIds.length,
                },
            });
            try {
                if (identity.state.publicKeyHex && identity.state.privateKeyHex) {
                    const groupService = new GroupService(identity.state.publicKeyHex, identity.state.privateKeyHex);
                    const deletionEvent = await groupService.hideMessage({
                        groupId: selectedConversation.groupId,
                        eventId: params.message.id
                    });
                    await publishGroupEvent({
                        relayUrl: selectedConversation.relayUrl,
                        event: deletionEvent
                    });
                    logAppEvent({
                        name: "messaging.delete_for_everyone_remote_result",
                        level: "info",
                        scope: { feature: "messaging", action: "delete_message" },
                        context: {
                            ...baseContext,
                            channel: "group",
                            resultCode: "published",
                            relayUrlHint: toIdHint(selectedConversation.relayUrl),
                        },
                    });
                }
            } catch (error) {
                console.error("Failed to delete group message:", error);
                logAppEvent({
                    name: "messaging.delete_for_everyone_remote_result",
                    level: "warn",
                    scope: { feature: "messaging", action: "delete_message" },
                    context: {
                        ...baseContext,
                        channel: "group",
                        resultCode: "failed",
                        reasonCode: "group_publish_failed",
                        relayUrlHint: toIdHint(selectedConversation.relayUrl),
                    },
                });
            }
            return;
        }

        if (selectedConversation.kind === "dm" && dmController) {
            let localDeleteApplied = false;
            const applyLocalDelete = (messageIdentityIds: ReadonlyArray<string>): void => {
                if (identity.state.publicKeyHex) {
                    chatStateStoreService.removeMessageIdentities(
                        identity.state.publicKeyHex,
                        params.conversationId,
                        messageIdentityIds,
                    );
                    messageIdentityIds.forEach((messageId) => {
                        void appendCanonicalDmRemovedEvent({
                            accountPublicKeyHex: identity.state.publicKeyHex!,
                            conversationId: params.conversationId,
                            messageId,
                            observedAtUnixMs: params.message.timestamp.getTime(),
                            idempotencySuffix: `dm_local_delete:${messageId}`,
                            source: "legacy_bridge",
                        });
                    });
                }
                messageBus.emitMessageDeleted(params.conversationId, params.message.id, {
                    messageIdentityIds,
                });
                logAppEvent({
                    name: "messaging.delete_for_everyone_local_applied",
                    level: "info",
                    scope: { feature: "messaging", action: "delete_message" },
                    context: {
                        ...baseContext,
                        deleteTargetCount: messageIdentityIds.length,
                    },
                });
                localDeleteApplied = true;
            };
            try {
                const fallbackLocalDeleteIds = toLocalDeleteIdentityIds(params.message);
                applyLocalDelete(fallbackLocalDeleteIds);
                const normalizedTargetIds = await buildDeleteTargetIdsForDm({
                    message: params.message,
                    senderPubkey: identity.state.publicKeyHex ?? null,
                    recipientPubkey: selectedConversation.pubkey,
                });
                const hasExpandedDeleteIds = normalizedTargetIds.some((targetId) => !fallbackLocalDeleteIds.includes(targetId));
                if (hasExpandedDeleteIds) {
                    applyLocalDelete(normalizedTargetIds);
                }
                normalizedTargetIds.forEach((targetId) => {
                    suppressMessageDeleteTombstone(targetId);
                });
                const primaryTargetId = normalizedTargetIds[0] ?? params.message.id;
                const encodedDeleteCommand = encodeCommandMessage(
                    createDeleteCommandMessage(primaryTargetId)
                );
                const deleteCommandSendResult = await dmController.sendDm({
                    peerPublicKeyInput: selectedConversation.pubkey,
                    plaintext: encodedDeleteCommand,
                    customTags: [
                        ["t", "message-delete"],
                        ...normalizedTargetIds.map((id) => ["e", id]),
                    ],
                });

                if (deleteCommandSendResult.messageId) {
                    messageBus.emitMessageDeleted(params.conversationId, deleteCommandSendResult.messageId);
                }

                if (deleteCommandSendResult.success) {
                    logAppEvent({
                        name: "messaging.delete_for_everyone_remote_result",
                        level: "info",
                        scope: { feature: "messaging", action: "delete_message" },
                        context: {
                            ...baseContext,
                            channel: "dm",
                            resultCode: "confirmed",
                            deliveryStatus: deleteCommandSendResult.deliveryStatus ?? null,
                            remoteMessageIdHint: toIdHint(deleteCommandSendResult.messageId ?? null),
                            deleteTargetCount: normalizedTargetIds.length,
                        },
                    });
                } else if (deleteCommandSendResult.deliveryStatus === "queued_retrying") {
                    logAppEvent({
                        name: "messaging.delete_for_everyone_remote_result",
                        level: "warn",
                        scope: { feature: "messaging", action: "delete_message" },
                        context: {
                            ...baseContext,
                            channel: "dm",
                            resultCode: "queued_retrying",
                            reasonCode: "dm_delete_command_queued_retrying",
                            deliveryStatus: deleteCommandSendResult.deliveryStatus,
                            remoteMessageIdHint: toIdHint(deleteCommandSendResult.messageId ?? null),
                            deleteTargetCount: normalizedTargetIds.length,
                        },
                    });
                } else {
                    logAppEvent({
                        name: "messaging.delete_for_everyone_remote_result",
                        level: "warn",
                        scope: { feature: "messaging", action: "delete_message" },
                        context: {
                            ...baseContext,
                            channel: "dm",
                            resultCode: "failed",
                            reasonCode: "dm_delete_command_delivery_failed",
                            deliveryStatus: deleteCommandSendResult.deliveryStatus ?? null,
                            remoteMessageIdHint: toIdHint(deleteCommandSendResult.messageId ?? null),
                            deleteTargetCount: normalizedTargetIds.length,
                        },
                    });
                }

                if (!deleteCommandSendResult.success && deleteCommandSendResult.deliveryStatus !== "queued_retrying") {
                    toast.warning("Delete command did not reach relays yet. Recipient removal may be delayed.");
                }
            } catch (error) {
                if (!localDeleteApplied) {
                    applyLocalDelete(toLocalDeleteIdentityIds(params.message));
                }
                console.error("Failed to send delete command:", error);
                logAppEvent({
                    name: "messaging.delete_for_everyone_remote_result",
                    level: "warn",
                    scope: { feature: "messaging", action: "delete_message" },
                    context: {
                        ...baseContext,
                        channel: "dm",
                        resultCode: "failed",
                        reasonCode: "dm_delete_command_exception",
                    },
                });
                toast.warning("Failed to sync delete command. Recipient may still see this message.");
            }
            return;
        }

        if (selectedConversation.kind === "dm" && !dmController) {
            logAppEvent({
                name: "messaging.delete_for_everyone_remote_result",
                level: "warn",
                scope: { feature: "messaging", action: "delete_message" },
                context: {
                    ...baseContext,
                    channel: "dm",
                    resultCode: "failed",
                    reasonCode: "dm_controller_missing",
                },
            });
        }
    }, [selectedConversation, identity.state, publishGroupEvent, dmController]);

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
                    const reactionEvent = await groupService.sendSealedReaction({
                        groupId: selectedConversation.groupId,
                        eventId: msg.id,
                        emoji: params.emoji
                    });
                    await publishGroupEvent({
                        relayUrl: selectedConversation.relayUrl,
                        event: reactionEvent
                    });
                }
            } catch (error) {
                console.error("Failed to send group reaction:", error);
            }
        }
    }, [selectedConversation, identity.state, publishGroupEvent]);

    return { handleSendMessage, deleteMessageForMe, deleteMessageForEveryone, toggleReaction };
}

export const useChatActionsInternals = {
    buildAttachmentMarkdown,
    buildDeletePlaintextCandidates,
    buildDeleteCreatedAtCandidates,
    buildDeleteTargetIdsForDm,
    deriveNip17RumorId,
    canDeleteMessageForEveryone,
    getDeleteForEveryoneRejectionReason,
};
