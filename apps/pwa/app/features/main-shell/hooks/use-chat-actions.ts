"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "@dweb/ui-kit";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { createEmptyReactions, toReactionsByEmoji } from "@/app/features/messaging/utils/logic";
import { type Message, type ReactionEmoji, UploadError, UploadErrorCode } from "@/app/features/messaging/types";
import type { UseDmControllerResult } from "../../messaging/controllers/v2/dm-controller";
import { GroupService } from "@/app/features/groups/services/group-service";
import { commitSealedGroupMessages } from "@/app/features/groups/services/sealed-group-message-persistence";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useUploadService } from "../../messaging/lib/upload-service";
import { messageBus } from "../../messaging/services/message-bus";
import {
    BEST_EFFORT_STORAGE_NOTE,
    shouldAvoidInMemoryAttachmentCaching,
    shouldSkipLocalAttachmentCachingForRuntimeSafety,
} from "../../messaging/lib/media-upload-policy";
import { cacheAttachmentLocally } from "../../vault/services/local-media-store";
import { shouldCacheAttachmentInVault } from "../../messaging/utils/attachment-storage-policy";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { logAppEvent } from "@/app/shared/log-app-event";
import { normalizeAttachmentUrl } from "@/app/shared/public-url";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { bootstrapCommunityRelayForChat } from "@/app/features/groups/services/community-relay-chat-bootstrap";
import { isLocalWorkspaceRelayHost } from "@/app/features/groups/services/workspace-relay-url";
import {
    assertRelayPublishSuccess,
    LOCAL_COMMUNITY_RELAY_UNREACHABLE_MESSAGE,
    resolveUserFacingErrorMessage,
} from "@/app/features/relays/services/relay-publish-user-copy";
import { getUploadFailureUserMessageFromUnknown } from "../../messaging/lib/upload-user-copy";
import { normalizeWorkspaceRelayUrl } from "@/app/features/groups/services/workspace-relay-url";
import { isStrictManagedWorkspaceRelay } from "@/app/features/groups/services/strict-managed-workspace";
import { MANAGED_WORKSPACE_DELETE_COPY } from "@/app/features/groups/services/managed-workspace-delete-copy";
import {
    ensureWorkspaceRelayTransportReady,
    shouldRetryPublishAfterWorkspaceCalibration,
} from "@/app/features/groups/services/workspace-relay-calibrator";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import { canDeleteMessageForEveryone, getDeleteForEveryoneRejectionReason } from "../../messaging/services/message-delete-permissions";
import { groupClientOperations } from "@/app/features/groups/services/group-client-operations";
import { collectMessageIdentityAliases } from "../../messaging/services/message-identity-alias-contract";
import type { Attachment } from "../../messaging/lib/message-queue";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
    messagingClientOperations,
} from "@/app/features/messaging/services/messaging-client-operations";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { selectProjectionConversationMessages } from "@/app/features/account-sync/services/account-projection-selectors";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import {
    buildDeleteTargetIdsForDm,
    buildLocalDeleteIdentityIdsForDm,
    deriveNip17RumorId,
} from "@/app/features/messaging/services/dm-delete-target-derivation";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import {
    sendWorkspaceKernelGroupMessage,
    removeWorkspaceKernelGroupMessage,
    WORKSPACE_KERNEL_GROUP_SEND_DEFERRED_MESSAGE,
} from "@/app/features/workspace-kernel/workspace-kernel-write-port";

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

const toLocalDeleteIdentityIds = (message: Message): ReadonlyArray<string> => (
    collectMessageIdentityAliases(message)
);

const isRetryableUploadError = (error: UploadError): boolean => (
    error.code === UploadErrorCode.NETWORK_ERROR
    || error.code === UploadErrorCode.PROVIDER_ERROR
);

const delay = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

const runWithConcurrencyLimit = async <T>(
    tasks: ReadonlyArray<() => Promise<T>>,
    concurrency: number,
): Promise<ReadonlyArray<T>> => {
    const results: T[] = new Array(tasks.length);
    const safeConcurrency = Math.max(1, Math.min(concurrency, tasks.length || 1));
    let nextIndex = 0;

    const worker = async (): Promise<void> => {
        while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            if (currentIndex >= tasks.length) {
                return;
            }
            results[currentIndex] = await tasks[currentIndex]!();
        }
    };

    await Promise.all(Array.from({ length: safeConcurrency }, () => worker()));
    return results;
};

const resolveAttachmentUploadConcurrency = (attachmentsCount: number): number => {
    if (attachmentsCount <= 1) {
        return 1;
    }
    if (attachmentsCount === 2) {
        return 2;
    }
    return 3;
};

const toScopedRelayUrl = (relayUrl: string): string | null => {
    const normalized = normalizeWorkspaceRelayUrl(relayUrl);
    const trimmed = normalized.replace(/\/+$/g, "");
    if (trimmed.length === 0 || UNKNOWN_RELAY_SENTINELS.has(trimmed)) return null;
    return /^wss?:\/\/.+/.test(trimmed) ? trimmed : null;
};

/**
 * Hook to manage chat actions like sending, deleting, and reacting to messages.
 */
export function useChatActions(dmController: UseDmControllerResult | null) {
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
    const relayPoolRef = useRelayPoolRef(relayPool);
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex || null });
    const relayListAddRelayRef = useRef(relayList.addRelay);
    relayListAddRelayRef.current = relayList.addRelay;
    const recipientMetadata = useResolvedProfileMetadata(
        selectedConversation?.kind === "dm" ? selectedConversation.pubkey : null,
        { live: false }
    );
    const isDeletedRecipient = selectedConversation?.kind === "dm" && recipientMetadata.isDeleted;
    const groupRelayUrl = selectedConversation?.kind === "group" ? selectedConversation.relayUrl : null;

    // Pre-connect community relay (persist + pool) when a group conversation is selected.
    useEffect(() => {
        if (!groupRelayUrl) {
            return;
        }
        let cancelled = false;
        void (async () => {
            await bootstrapCommunityRelayForChat({
                rawRelayUrl: groupRelayUrl,
                pool: relayPoolRef.current,
                addRelay: (relayParams) => relayListAddRelayRef.current(relayParams),
            });
            if (cancelled) {
                return;
            }
            const scopedUrl = toScopedRelayUrl(groupRelayUrl);
            if (scopedUrl && typeof relayPoolRef.current.addTransientRelay === "function") {
                relayPoolRef.current.addTransientRelay(scopedUrl);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [groupRelayUrl, relayPoolRef]);

    const publishGroupEvent = useCallback(async (params: Readonly<{ relayUrl: string; event: Readonly<{ id: string }> }>): Promise<void> => {
        const pool = relayPoolRef.current;
        const payload = JSON.stringify(["EVENT", params.event]);
        let activeRelayUrl = params.relayUrl;
        let scopedRelayUrl = toScopedRelayUrl(activeRelayUrl);
        let result: MultiRelayPublishResult;

        const bootstrapRelayUrl = await bootstrapCommunityRelayForChat({
            rawRelayUrl: params.relayUrl,
            pool,
            addRelay: (relayParams) => relayListAddRelayRef.current(relayParams),
        });
        if (!bootstrapRelayUrl && isLocalWorkspaceRelayHost(params.relayUrl)) {
            throw new Error(LOCAL_COMMUNITY_RELAY_UNREACHABLE_MESSAGE);
        }
        if (bootstrapRelayUrl) {
            activeRelayUrl = bootstrapRelayUrl;
            scopedRelayUrl = toScopedRelayUrl(activeRelayUrl);
        }

        const resolveScopedRelay = async (forceCalibration: boolean): Promise<string | null> => {
            const snapshot = typeof pool.getWritableRelaySnapshot === "function"
                ? pool.getWritableRelaySnapshot(scopedRelayUrl ? [scopedRelayUrl] : undefined)
                : null;
            const writableCount = snapshot?.writableRelayUrls?.length ?? 0;
            if (!forceCalibration && scopedRelayUrl && writableCount > 0) {
                return scopedRelayUrl;
            }
            const calibration = await ensureWorkspaceRelayTransportReady({
                rawUrl: activeRelayUrl,
                pool,
                timeoutMs: 5000,
            });
            activeRelayUrl = calibration.canonicalUrl;
            scopedRelayUrl = toScopedRelayUrl(activeRelayUrl);
            return scopedRelayUrl;
        };

        await resolveScopedRelay(!scopedRelayUrl);

        const writableBeforePublish = typeof pool.getWritableRelaySnapshot === "function"
            ? pool.getWritableRelaySnapshot(scopedRelayUrl ? [scopedRelayUrl] : undefined)
            : null;
        const publishRelayUrl = writableBeforePublish?.writableRelayUrls?.[0] ?? scopedRelayUrl;

        // ── Diagnostic: capture relay state before publish attempt ──
        const snapshot = typeof pool.getWritableRelaySnapshot === "function"
            ? pool.getWritableRelaySnapshot(scopedRelayUrl ? [scopedRelayUrl] : undefined)
            : null;
        const poolConnections = pool.connections ?? [];
        const openRelays = poolConnections.filter((c: { status: string }) => c.status === "open").map((c: { url: string }) => c.url);
        console.warn("[publishGroupEvent] diagnostic", {
            rawRelayUrl: params.relayUrl,
            activeRelayUrl,
            scopedRelayUrl,
            publishRelayUrl,
            eventIdHint: toIdHint(params.event.id),
            openRelayCount: openRelays.length,
            openRelays: openRelays.slice(0, 5),
            writableSnapshot: snapshot ? {
                writableCount: snapshot.writableRelayUrls?.length ?? 0,
                writableUrls: snapshot.writableRelayUrls?.slice(0, 5),
            } : "unavailable",
            hasPublishToUrls: typeof pool.publishToUrls === "function",
            hasAddTransientRelay: typeof pool.addTransientRelay === "function",
        });

        // Ensure the community relay is registered as transient before publishing.
        // publishToUrls will also attempt this, but pre-warming here gives the socket
        // more time to complete handshake before the publish timeout starts.
        if (publishRelayUrl && typeof pool.addTransientRelay === "function") {
            pool.addTransientRelay(publishRelayUrl);
        }

        if (publishRelayUrl && typeof pool.publishToUrls === "function") {
            result = await pool.publishToUrls([publishRelayUrl], payload);
        } else if (publishRelayUrl && typeof pool.publishToUrl === "function") {
            const single = await pool.publishToUrl(publishRelayUrl, payload);
            result = {
                success: single.success,
                successCount: single.success ? 1 : 0,
                totalRelays: 1,
                results: [single],
                overallError: single.success ? undefined : (single.error ?? "Scoped publish failed"),
            };
        } else if (publishRelayUrl && typeof pool.publishToRelay === "function") {
            const single = await pool.publishToRelay(publishRelayUrl, payload);
            result = {
                success: single.success,
                successCount: single.success ? 1 : 0,
                totalRelays: 1,
                results: [single],
                overallError: single.success ? undefined : (single.error ?? "Scoped publish failed"),
            };
        } else {
            result = await pool.publishToAll(payload);
        }

        // Retry once on transient relay closure — the socket may have been torn down
        // by concurrent activity (e.g. multi-profile relay reconnect storms).
        if (!result.success && result.overallError?.includes("closed before OK")) {
            if (scopedRelayUrl && typeof pool.reconnectRelay === "function") {
                pool.reconnectRelay(scopedRelayUrl);
            }
            if (scopedRelayUrl && typeof pool.waitForScopedConnection === "function") {
                await pool.waitForScopedConnection([scopedRelayUrl], 5000);
            }
            if (scopedRelayUrl && typeof pool.publishToUrls === "function") {
                result = await pool.publishToUrls([scopedRelayUrl], payload);
            }
        }

        if (!result.success && shouldRetryPublishAfterWorkspaceCalibration(result.overallError)) {
            if (!bootstrapRelayUrl && isLocalWorkspaceRelayHost(params.relayUrl)) {
                throw new Error(LOCAL_COMMUNITY_RELAY_UNREACHABLE_MESSAGE);
            }
            scopedRelayUrl = await resolveScopedRelay(true);
            const retriedWritable = typeof pool.getWritableRelaySnapshot === "function"
                ? pool.getWritableRelaySnapshot(scopedRelayUrl ? [scopedRelayUrl] : undefined)
                : null;
            const retriedPublishUrl = retriedWritable?.writableRelayUrls?.[0] ?? scopedRelayUrl;
            if (retriedPublishUrl && typeof pool.addTransientRelay === "function") {
                pool.addTransientRelay(retriedPublishUrl);
            }
            if (retriedPublishUrl && typeof pool.publishToUrls === "function") {
                result = await pool.publishToUrls([retriedPublishUrl], payload);
            } else if (retriedPublishUrl && typeof pool.publishToUrl === "function") {
                const single = await pool.publishToUrl(retriedPublishUrl, payload);
                result = {
                    success: single.success,
                    successCount: single.success ? 1 : 0,
                    totalRelays: 1,
                    results: [single],
                    overallError: single.success ? undefined : (single.error ?? "Scoped publish failed"),
                };
            }
        }

        assertRelayPublishSuccess(result, {
            operation: "Could not publish to community relays",
            fallback: "Failed to publish group event to relay scope.",
            communityRelayUrl: params.relayUrl,
        });
    }, [relayPoolRef]);

    const handleSendMessage = useCallback(async () => {
        if (!selectedConversation || (!messageInput.trim() && pendingAttachments.length === 0)) return;
        if (isDeletedRecipient) {
            toast.warning("This contact account has been removed. New messages cannot be delivered.");
            return;
        }

        // 1. Upload Attachments if any
        let finalContent = messageInput;
        const attachments: Attachment[] = [];

        if (pendingAttachments.length > 0) {
            setIsUploadingAttachment(true);
            setUploadStage("encrypting");
            setAttachmentError(null);

            try {
                const uploadErrors: UploadError[] = [];
                setUploadStage("uploading");

                const fileBytesMap = new Map<string, Uint8Array>();
                const uploadedFileByUrl = new Map<string, File>();
                const uploadedResults = await runWithConcurrencyLimit(
                    pendingAttachments.map((file) => async () => {
                        try {
                            let uploaded;
                            try {
                                uploaded = await uploadService.uploadFile(file);
                            } catch (firstError) {
                                const normalizedFirstError = firstError instanceof UploadError
                                    ? firstError
                                    : new UploadError(UploadErrorCode.UNKNOWN, String(firstError));
                                if (!isRetryableUploadError(normalizedFirstError)) {
                                    throw normalizedFirstError;
                                }
                                await delay(700);
                                uploaded = await uploadService.uploadFile(file);
                            }
                            const cachedBytes = shouldAvoidInMemoryAttachmentCaching(file)
                                ? null
                                : new Uint8Array(await file.arrayBuffer());
                            return {
                                ok: true as const,
                                uploaded,
                                sourceFile: file,
                                cachedBytes,
                            };
                        } catch (error) {
                            const uploadError = error instanceof UploadError
                                ? error
                                : new UploadError(UploadErrorCode.UNKNOWN, String(error));
                            return {
                                ok: false as const,
                                uploadError,
                            };
                        }
                    }),
                    resolveAttachmentUploadConcurrency(pendingAttachments.length),
                );

                uploadedResults.forEach((result) => {
                    if (!result.ok) {
                        uploadErrors.push(result.uploadError);
                        return;
                    }
                    attachments.push(result.uploaded);
                    uploadedFileByUrl.set(result.uploaded.url, result.sourceFile);
                    if (result.cachedBytes) {
                        fileBytesMap.set(result.uploaded.url, result.cachedBytes);
                    }
                });

                if (attachments.length === 0) {
                    throw uploadErrors[0] || new UploadError(UploadErrorCode.UNKNOWN, "All uploads failed");
                }
                if (uploadErrors.length > 0) {
                    toast.warning(`Uploaded ${attachments.length}/${pendingAttachments.length} files. Some files failed.`);
                }

                // Append URLs to content using markdown links to preserve the original filenames
                const urls = attachments
                    .map((attachment) => `[${attachment.fileName}](${normalizeAttachmentUrl(attachment.url)})`)
                    .join(" ");
                if (finalContent.trim()) {
                    finalContent += "\n\n" + urls;
                } else {
                    finalContent = urls;
                }

                // Do not block send path on local caching.
                const cacheableAttachments = attachments.filter((attachment) => {
                    if (!shouldCacheAttachmentInVault(attachment)) {
                        return false;
                    }
                    const sourceFile = uploadedFileByUrl.get(attachment.url);
                    if (!sourceFile) {
                        return true;
                    }
                    return !shouldSkipLocalAttachmentCachingForRuntimeSafety(sourceFile);
                });
                void Promise.all(
                    cacheableAttachments.map((attachment) => cacheAttachmentLocally(attachment, "sent", fileBytesMap.get(attachment.url)))
                ).catch((e) => {
                    console.warn("[Vault] Failed to cache sent attachments locally:", e);
                });
            } catch (error: unknown) {
                console.warn("Failed to upload attachment:", error);

                const errorMessage = getUploadFailureUserMessageFromUnknown(
                    error,
                    "Upload failed. Try another provider in Storage settings.",
                    { storageNote: BEST_EFFORT_STORAGE_NOTE },
                );

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
        const conversationId = selectedConversation.kind === "group"
            ? toGroupConversationId({
                groupId: selectedConversation.groupId,
                relayUrl: selectedConversation.relayUrl,
                communityId: selectedConversation.communityId,
            })
            : selectedConversation.id;

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

                if (isWorkspaceKernelAuthority()) {
                    const kernelSend = await sendWorkspaceKernelGroupMessage({
                        conversationId,
                        groupId: selectedConversation.groupId,
                        relayUrl: selectedConversation.relayUrl,
                        communityId: selectedConversation.communityId,
                        publicKeyHex: identity.state.publicKeyHex as PublicKeyHex,
                        privateKeyHex: identity.state.privateKeyHex,
                        plaintext: currentInput,
                        replyToMessageId: currentReplyTo?.messageId,
                        publishSealedEvent: publishGroupEvent,
                    });
                    if (!kernelSend.ok) {
                        throw new Error(kernelSend.errorMessage || WORKSPACE_KERNEL_GROUP_SEND_DEFERRED_MESSAGE);
                    }
                    messageBus.emitNewMessage(conversationId, kernelSend.message);
                } else {
                const groupService = new GroupService(
                    identity.state.publicKeyHex,
                    identity.state.privateKeyHex,
                );

                const event = await groupService.sendSealedMessage({
                    groupId: selectedConversation.groupId,
                    content: currentInput,
                    replyTo: currentReplyTo?.messageId,
                });

                await publishGroupEvent({
                    relayUrl: selectedConversation.relayUrl,
                    event,
                });

                const createdAtUnixSeconds = typeof event.created_at === "number"
                    ? event.created_at
                    : Math.floor(Date.now() / 1000);
                await commitSealedGroupMessages({
                    conversationId,
                    groupId: selectedConversation.groupId,
                    publicKeyHex: identity.state.publicKeyHex as PublicKeyHex,
                    messages: [{
                        id: event.id,
                        pubkey: identity.state.publicKeyHex,
                        created_at: createdAtUnixSeconds,
                        content: currentInput,
                    }],
                });

                const optimisticMessage: Message = {
                    id: event.id,
                    kind: 'user',
                    content: currentInput,
                    timestamp: new Date(createdAtUnixSeconds * 1000),
                    isOutgoing: true,
                    status: 'delivered',
                    eventId: event.id,
                    senderPubkey: identity.state.publicKeyHex,
                    reactions: createEmptyReactions(),
                    replyTo: currentReplyTo ? {
                        messageId: currentReplyTo.messageId,
                        previewText: currentReplyTo.previewText,
                    } : undefined,
                    attachments,
                };

                messageBus.emitNewMessage(conversationId, optimisticMessage);
                }
            }
            setUploadStage("idle");
            setIsUploadingAttachment(false);
        } catch (error: unknown) {
            console.error("Failed to send message:", error);
            const fallback = selectedConversation?.kind === "group"
                ? "Failed to send group message. Check relay scope and retry."
                : "Failed to send message. Check relay connection and retry.";
            toast.error(resolveUserFacingErrorMessage(error, fallback));
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
        const immediateIds = toLocalDeleteIdentityIds(params.message);
        messageBus.emitMessageDeleted(params.conversationId, params.message.id, {
            messageIdentityIds: immediateIds,
            sourceProfileId: getResolvedProfileId() || undefined,
        });

        void (async () => {
            const deleteIds = (
                selectedConversation?.kind === "dm"
                    ? await buildLocalDeleteIdentityIdsForDm({
                        message: params.message,
                        myPublicKeyHex: identity.state.publicKeyHex ?? null,
                        peerPublicKeyHex: selectedConversation.pubkey,
                    })
                    : immediateIds
            );
            const activeProfileId = getResolvedProfileId() || undefined;
            if (identity.state.publicKeyHex) {
                await messagingClientOperations.deleteDmForMe({
                    conversationId: params.conversationId,
                    messageIdentityIds: deleteIds,
                    accountPublicKeyHex: identity.state.publicKeyHex,
                    profileId: activeProfileId,
                    observedAtUnixMs: params.message.timestamp.getTime(),
                    prioritizeUiResponse: true,
                    replayProjection: true,
                    redactTimelineEvents: false,
                });
            } else {
                await messagingClientOperations.persistDmSuppressionOnly({
                    conversationId: params.conversationId,
                    messageIdentityIds: deleteIds,
                    profileId: activeProfileId,
                });
            }
        })().catch((error) => {
            console.error("[messaging] hide on device failed", error);
        });
    }, [identity.state.publicKeyHex, selectedConversation]);

    const emitRestoredMessagesToBus = useCallback((
        conversationId: string,
        restoredIdentityIds: ReadonlyArray<string>,
    ): void => {
        const accountPublicKeyHex = identity.state.publicKeyHex;
        if (!accountPublicKeyHex || restoredIdentityIds.length === 0) {
            return;
        }
        const projection = accountProjectionRuntime.getSnapshot().projection;
        if (!projection) {
            return;
        }
        const restoredSet = new Set(restoredIdentityIds);
        const visibleMessages = selectProjectionConversationMessages({
            projection,
            conversationId,
            myPublicKeyHex: accountPublicKeyHex,
        });
        visibleMessages.forEach((message) => {
            const aliases = collectMessageIdentityAliases(message);
            if (!aliases.some((alias) => restoredSet.has(alias))) {
                return;
            }
            messageBus.emitNewMessage(conversationId, message);
        });
        emitAccountSyncMutation("dm_history_changed");
    }, [identity.state.publicKeyHex]);

    const showMessageOnDeviceAgain = useCallback(async (params: { conversationId: string; message: Message }) => {
        const identityIds = (
            selectedConversation?.kind === "dm"
                ? await buildLocalDeleteIdentityIdsForDm({
                    message: params.message,
                    myPublicKeyHex: identity.state.publicKeyHex ?? null,
                    peerPublicKeyHex: selectedConversation.pubkey,
                })
                : toLocalDeleteIdentityIds(params.message)
        );
        const activeProfileId = getResolvedProfileId() || undefined;
        if (!identity.state.publicKeyHex) {
            return;
        }
        const restoredIds = await messagingClientOperations.showDmOnDeviceAgain({
            conversationId: params.conversationId,
            messageIdentityIds: identityIds,
            accountPublicKeyHex: identity.state.publicKeyHex,
            profileId: activeProfileId,
            observedAtUnixMs: params.message.timestamp.getTime(),
        });
        emitRestoredMessagesToBus(params.conversationId, restoredIds);
    }, [emitRestoredMessagesToBus, identity.state.publicKeyHex, selectedConversation]);

    const showAllHiddenMessagesOnDevice = useCallback(async (params: Readonly<{
        conversationId: string;
        messages: ReadonlyArray<Message>;
    }>) => {
        if (!identity.state.publicKeyHex || params.messages.length === 0) {
            return;
        }
        const activeProfileId = getResolvedProfileId() || undefined;
        const restoredIdSet = new Set<string>();
        for (const message of params.messages) {
            const identityIds = (
                selectedConversation?.kind === "dm"
                    ? await buildLocalDeleteIdentityIdsForDm({
                        message,
                        myPublicKeyHex: identity.state.publicKeyHex,
                        peerPublicKeyHex: selectedConversation.pubkey,
                    })
                    : toLocalDeleteIdentityIds(message)
            );
            const restored = await messagingClientOperations.showDmOnDeviceAgain({
                conversationId: params.conversationId,
                messageIdentityIds: identityIds,
                accountPublicKeyHex: identity.state.publicKeyHex,
                profileId: activeProfileId,
                observedAtUnixMs: message.timestamp.getTime(),
            });
            restored.forEach((id) => restoredIdSet.add(id));
        }
        emitRestoredMessagesToBus(params.conversationId, Array.from(restoredIdSet));
    }, [emitRestoredMessagesToBus, identity.state.publicKeyHex, selectedConversation]);

    const deleteMessageForEveryone = useCallback(async (params: Readonly<{
        conversationId: string;
        message: Message;
        suppressManagedWorkspaceToast?: boolean;
    }>) => {
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
            const groupConversation = selectedConversation;
            const localDeleteIds = toLocalDeleteIdentityIds(params.message);
            const managedWorkspaceRemove = isStrictManagedWorkspaceRelay(groupConversation.relayUrl ?? null)
                && isWorkspaceKernelAuthority();

            if (managedWorkspaceRemove && identity.state.publicKeyHex && identity.state.privateKeyHex) {
                const removed = await removeWorkspaceKernelGroupMessage({
                    conversationId: params.conversationId,
                    groupId: groupConversation.groupId,
                    relayUrl: groupConversation.relayUrl,
                    communityId: groupConversation.communityId,
                    message: params.message,
                    messageIdentityIds: localDeleteIds,
                    publicKeyHex: identity.state.publicKeyHex,
                    privateKeyHex: identity.state.privateKeyHex,
                    publishSealedEvent: publishGroupEvent,
                });
                if (removed.ok) {
                    logAppEvent({
                        name: "messaging.delete_for_everyone_remote_result",
                        level: "info",
                        scope: { feature: "messaging", action: "delete_message" },
                        context: {
                            ...baseContext,
                            channel: "group",
                            resultCode: removed.relayPublished ? "published" : "local_only",
                            reasonCode: removed.relayPublished ? null : "relay_publish_skipped",
                            relayUrlHint: toIdHint(groupConversation.relayUrl),
                            deleteTargetCount: localDeleteIds.length,
                        },
                    });
                    if (!params.suppressManagedWorkspaceToast) {
                        toast.success(MANAGED_WORKSPACE_DELETE_COPY.removedFromWorkspaceToast);
                    }
                } else {
                    logAppEvent({
                        name: "messaging.delete_for_everyone_remote_result",
                        level: "warn",
                        scope: { feature: "messaging", action: "delete_message" },
                        context: {
                            ...baseContext,
                            channel: "group",
                            resultCode: "failed",
                            reasonCode: removed.errorMessage,
                            relayUrlHint: toIdHint(groupConversation.relayUrl),
                        },
                    });
                    toast.warning("Could not remove this message from the workspace on this device.");
                }
                return;
            }

            if (identity.state.publicKeyHex) {
                groupClientOperations.hideMessageForViewer({
                    accountPublicKeyHex: identity.state.publicKeyHex,
                    conversationId: params.conversationId,
                    primaryMessageId: params.message.id,
                    messageIdentityIds: localDeleteIds,
                    observedAtUnixMs: params.message.timestamp.getTime(),
                });
            }
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
                    logAppEvent({
                        name: "messaging.delete_for_everyone_remote_result",
                        level: "info",
                        scope: { feature: "messaging", action: "delete_message" },
                        context: {
                            ...baseContext,
                            channel: "group",
                            resultCode: "skipped",
                            reasonCode: "group_backend_disabled",
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
            try {
                const myPubkey = identity.state.publicKeyHex;
                const immediateIds = collectMessageIdentityAliases(params.message);
                messageBus.emitMessageDeleted(params.conversationId, params.message.id, {
                    messageIdentityIds: immediateIds,
                    sourceProfileId: getResolvedProfileId() || undefined,
                });
                const targetIdentityIds = myPubkey
                    ? await buildDeleteTargetIdsForDm({
                        message: params.message,
                        senderPubkey: myPubkey,
                        recipientPubkey: selectedConversation.pubkey,
                    })
                    : immediateIds;
                const deleted = await dmController.deleteMessage({
                    messageId: params.message.id,
                    conversationId: params.conversationId,
                    peerPublicKeyHex: selectedConversation.pubkey,
                    mode: "for_everyone",
                    messageHint: params.message,
                    targetIdentityIds,
                });
                if (deleted) {
                    toast.info("Recall sent — the other person’s Obscur app should hide this message when it receives the command.");
                } else {
                    toast.warning(
                        "Recall could not reach relays. The message is hidden on this device only — the other person may still see it.",
                    );
                }
            } catch (error) {
                console.error("Failed to delete message for everyone:", error);
                logAppEvent({
                    name: "messaging.delete_for_everyone_remote_result",
                    level: "warn",
                    scope: { feature: "messaging", action: "delete_message" },
                    context: {
                        ...baseContext,
                        channel: "dm",
                        resultCode: "failed",
                        reasonCode: "dm_delete_controller_exception",
                    },
                });
                toast.warning("Failed to sync redaction command. Recipient may still see this message.");
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
            return;
        }
    }, [selectedConversation, identity.state, dmController]);

    return {
        handleSendMessage,
        deleteMessageForMe,
        deleteMessageForEveryone,
        showMessageOnDeviceAgain,
        showAllHiddenMessagesOnDevice,
        toggleReaction,
    };
}

export const useChatActionsInternals = {
    runWithConcurrencyLimit,
    resolveAttachmentUploadConcurrency,
    buildDeleteTargetIdsForDm,
    buildLocalDeleteIdentityIdsForDm,
    deriveNip17RumorId,
    canDeleteMessageForEveryone,
    getDeleteForEveryoneRejectionReason,
};
