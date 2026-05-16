import { NOSTR_SAFETY_LIMITS } from "@/app/features/relays/utils/nostr-safety-limits";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { buildDmEvent, type DmEventBuildResult, type DmFormat } from "./dm-event-builder";
import { prepareOutgoingDm } from "./outgoing-dm-send-preparer";
import { publishOutgoingDm, queueOutgoingDmForRetry } from "./outgoing-dm-publisher";
import { applyRecipientRelayHints } from "./recipient-relay-hints";
import { ensureConnectedToRecipientRelays } from "./recipient-discovery-service";
import { errorHandler } from "../lib/error-handler";
import { extractAttachmentsFromContent } from "../utils/logic";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { EnhancedDMControllerState } from "./dm-controller-state";
import type { RelayPool, SendResult } from "./enhanced-dm-controller";
import type { MessageQueue, Message } from "../lib/message-queue";
import { messageMemoryManager } from "../lib/performance-optimizer";
import { nip65Service } from "@/app/features/relays/utils/nip65-service";
import type { Attachment, MessageKind } from "../types";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { protocolCoreAdapter } from "@/app/features/runtime/protocol-core-adapter";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { RelaySendSnapshot } from "@/app/features/search/types/discovery";
import { deliveryDiagnosticsStore } from "../services/delivery-diagnostics-store";
import { reportSenderDeliveryIssue } from "../services/delivery-troubleshooting-reporter";
import { peerRelayEvidenceStore } from "../services/peer-relay-evidence-store";
import { resolveDmHybridRelayTargeting } from "../lib/resolve-dm-hybrid-relay-targets";

/**
 * Parameters for orchestrating the outgoing DM flow
 */
export interface OutgoingDmOrchestrationParams {
    peerPublicKeyInput: string;
    plaintext: string;
    attachments?: ReadonlyArray<Attachment>;
    replyTo?: string;
    customTags?: string[][];
    myPublicKeyHex: PublicKeyHex;
    myPrivateKeyHex: PrivateKeyHex;
    pool: RelayPool;
    messageQueue: MessageQueue | null;
    recipientRelayCheckCache: React.MutableRefObject<Set<string>>;
    recipientRelayResolutionCache: React.MutableRefObject<Map<string, ReadonlyArray<string>>>;
    pendingMessages: React.MutableRefObject<Map<string, Message>>;
    relayRequestTimes: React.MutableRefObject<Map<string, number>>;
    maxMessagesInMemory: number;
    setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
    createReadyState: (messages: ReadonlyArray<Message>) => EnhancedDMControllerState;
    createErrorState: (error: string, messages: ReadonlyArray<Message>, handledError: any) => EnhancedDMControllerState;
    profileId?: string;
}

const getLiveRelaySendSnapshot = (pool: RelayPool): RelaySendSnapshot => {
    if (typeof pool.getWritableRelaySnapshot === "function") {
        const snapshot = pool.getWritableRelaySnapshot();
        return {
            atUnixMs: snapshot.atUnixMs,
            writableRelayUrls: snapshot.writableRelayUrls,
            openRelayCount: snapshot.openRelayCount,
        };
    }
    const writableRelayUrls = pool.connections
        .filter((connection) => connection.status === "open")
        .map((connection) => connection.url);
    return {
        atUnixMs: Date.now(),
        writableRelayUrls,
        openRelayCount: writableRelayUrls.length,
    };
};

const getDurableRelaySuccessMinimum = (targetRelayCount: number): number => (
    targetRelayCount >= 3 ? 2 : 1
);

const resolveRelayPreflightDecision = (params: Readonly<{
    openRelayCount: number;
    scopedWritableRelayCount: number;
    durableRelayMinimum: number;
}>): "queue_no_writable_relays" | "attempt_degraded" | "attempt" => {
    if (params.openRelayCount <= 0 || params.scopedWritableRelayCount <= 0) {
        return "queue_no_writable_relays";
    }
    if (params.scopedWritableRelayCount < params.durableRelayMinimum) {
        return "attempt_degraded";
    }
    return "attempt";
};

const resolveSenderDeliveryIssueStatus = (publishResult: Readonly<{
    success: boolean;
    successCount: number;
}>): "queued_retrying" | "failed" => (
    !publishResult.success && publishResult.successCount > 0
        ? "queued_retrying"
        : "failed"
);

const isRetryableRelayFailureReasonCode = (reasonCode: string | undefined): boolean => (
    reasonCode === "no_writable_relays"
    || reasonCode === "quorum_not_met"
    || reasonCode === "relay_degraded"
);

const resolveSendDeliveryStatus = (publishResult: Readonly<{
    success: boolean;
    status?: "ok" | "partial" | "queued" | "failed";
    reasonCode?: string;
    successCount?: number;
}>, options?: Readonly<{
    queueRetryableFailures?: boolean;
}>): "sent_quorum" | "sent_partial" | "queued_retrying" | "failed" => {
    if (publishResult.success) {
        return publishResult.status === "partial" ? "sent_partial" : "sent_quorum";
    }
    const queueRetryableFailures = options?.queueRetryableFailures === true;
    if (publishResult.status === "queued") {
        return "queued_retrying";
    }
    if (isRetryableRelayFailureReasonCode(publishResult.reasonCode)) {
        if (queueRetryableFailures) {
            return "queued_retrying";
        }
        return (publishResult.successCount ?? 0) > 0 ? "sent_partial" : "failed";
    }
    return "failed";
};

const getScopedWritableRelayUrls = (params: Readonly<{
    pool: RelayPool;
    targetRelayUrls: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
    if (params.targetRelayUrls.length === 0) {
        return [];
    }
    if (typeof params.pool.getWritableRelaySnapshot === "function") {
        return params.pool.getWritableRelaySnapshot(params.targetRelayUrls).writableRelayUrls;
    }
    const targetSet = new Set(params.targetRelayUrls);
    return params.pool.connections
        .filter((connection) => connection.status === "open" && targetSet.has(connection.url))
        .map((connection) => connection.url);
};

const shouldForceLegacyDmFormat = (customTags?: string[][]): boolean => {
    if (!customTags) {
        return false;
    }
    return customTags.some((tag) =>
        tag[0] === "t"
        && false
    );
};

const getConnectionLifecycleTag = (customTags?: ReadonlyArray<ReadonlyArray<string>>): string | null => {
    const transportTag = customTags?.find((tag) => tag[0] === "t")?.[1];
    if (
        transportTag === "connection-request"
        || transportTag === "connection-accept"
        || transportTag === "connection-decline"
        || transportTag === "connection-cancel"
        || transportTag === "connection-received"
        || transportTag === "connection-receipt"
    ) {
        return transportTag;
    }
    return null;
};

const resolveOutgoingMessageKind = (customTags?: ReadonlyArray<ReadonlyArray<string>>): MessageKind => {
    const lifecycleTag = customTags?.find((tag) => tag[0] === "t")?.[1];
    return lifecycleTag === "message-delete" ? "command" : "user";
};

const getTransportTag = (customTags?: ReadonlyArray<ReadonlyArray<string>>): string | null => (
    customTags?.find((tag) => tag[0] === "t")?.[1] ?? null
);

const isRealtimeVoiceTransportTag = (transportTag: string | null): boolean => (
    transportTag === "voice-call-signal" || transportTag === "voice-call-invite"
);

const dedupeRelayUrls = (relayUrls: ReadonlyArray<string>): ReadonlyArray<string> => (
    Array.from(new Set(relayUrls.map((url) => url.trim()).filter((url) => url.length > 0)))
);

export const resolveTargetRelayUrls = resolveDmHybridRelayTargeting;

const shouldPreferLegacyDmFormat = (params: Readonly<{
    customTags?: string[][];
    useModernDMs: boolean;
    hasPublishToAll: boolean;
    stabilityModeEnabled: boolean;
    protocolCoreEnabled: boolean;
    preferModernGiftWrap: boolean;
}>): boolean => {
    if (getConnectionLifecycleTag(params.customTags)) {
        return false;
    }
    if (params.preferModernGiftWrap) {
        return false;
    }
    if (shouldForceLegacyDmFormat(params.customTags)) {
        return true;
    }
    if (params.stabilityModeEnabled) {
        return true;
    }
    if (!params.protocolCoreEnabled) {
        return true;
    }
    if (!params.useModernDMs) {
        return true;
    }
    if (!params.hasPublishToAll) {
        return true;
    }
    return false;
};

const resolveProtocolEnvelopeTags = async (
    recipientPubkey: PublicKeyHex
): Promise<ReadonlyArray<ReadonlyArray<string>>> => {
    const policy = getV090RolloutPolicy(PrivacySettingsService.getSettings());
    if (!policy.protocolCoreEnabled || !policy.x3dhRatchetEnabled) {
        return [];
    }

    const handshake = await protocolCoreAdapter.runX3DHHandshake(recipientPubkey);
    if (!handshake.ok) {
        if (handshake.reason === "failed") {
            logAppEvent({
                name: "messaging.dm.send.protocol_handshake_failed",
                level: "warn",
                scope: { feature: "messaging", action: "send_dm" },
                context: { reason: handshake.message || "Protocol handshake failed" },
            });
        }
        return [];
    }
    if (!handshake.value.ok || !handshake.value.sessionId) {
        const rejectedReason = !handshake.value.ok
            ? (handshake.value.message || handshake.value.reason || "Handshake rejected")
            : "Handshake did not return a session id";
        logAppEvent({
            name: "messaging.dm.send.protocol_handshake_rejected",
            level: "warn",
            scope: { feature: "messaging", action: "send_dm" },
            context: { reason: rejectedReason },
        });
        return [];
    }

    let counter = 1;
    const ratchet = await protocolCoreAdapter.getRatchetSession(handshake.value.sessionId);
    if (ratchet.ok && ratchet.value.sendingChainLength > 0) {
        counter = ratchet.value.sendingChainLength;
    }

    return [
        ["obscur-envelope-version", "v090_x3dr"],
        ["obscur-session-id", handshake.value.sessionId],
        ["obscur-counter", `${counter}`],
    ];
};

/**
 * Orchestrates the complete sending pipeline for a direct message
 */
export const orchestrateOutgoingDm = async (
    params: OutgoingDmOrchestrationParams
): Promise<SendResult> => {
    const {
        peerPublicKeyInput, plaintext, attachments, replyTo, customTags,
        myPublicKeyHex, myPrivateKeyHex, pool, messageQueue,
        recipientRelayCheckCache, recipientRelayResolutionCache, pendingMessages, relayRequestTimes,
        maxMessagesInMemory, setState, createReadyState, createErrorState,
        profileId,
    } = params;

    const networkCheck = errorHandler.canAttemptOperation();
    if (!networkCheck.canAttempt) {
        if (!errorHandler.getNetworkState().isOnline) errorHandler.handleNetworkOffline({ operation: 'sendMessage' });
        else errorHandler.handleAllRelaysFailed({ operation: 'sendMessage' });
    }

    const parsedRecipient = parsePublicKeyInput(peerPublicKeyInput);
    if (!parsedRecipient.ok) {
        const error = 'Invalid recipient public key. Verify the contact key or QR and try again.';
        setState(prev => createErrorState(error, prev.messages, errorHandler.handleInvalidInput(error)));
        return { success: false, messageId: '', relayResults: [], error };
    }
    const recipientPubkey = parsedRecipient.publicKeyHex;

    applyRecipientRelayHints({
        peerPublicKeyInput,
        recipientPubkey,
        addTransientRelay: pool.addTransientRelay,
        getWriteRelays: (pubkey) => nip65Service.getWriteRelays(pubkey)
    });

    const cleanedPlaintext = plaintext.trim();
    if (cleanedPlaintext.length === 0) return { success: false, messageId: '', relayResults: [], error: 'Message cannot be empty' };
    if (cleanedPlaintext.length > NOSTR_SAFETY_LIMITS.maxDmPlaintextChars) {
        const error = `Message is too long (max ${NOSTR_SAFETY_LIMITS.maxDmPlaintextChars} chars). Shorten it and resend.`;
        setState(prev => createErrorState(error, prev.messages, errorHandler.handleInvalidInput(error)));
        return { success: false, messageId: '', relayResults: [], error };
    }

    let lastRelayScopeSource: string | undefined;
    let lastTargetRelayUrls: ReadonlyArray<string> = [];
    try {
        let discoveredRecipientRelayUrls: ReadonlyArray<string> = [];
        try {
            discoveredRecipientRelayUrls = await ensureConnectedToRecipientRelays({
                pool,
                recipientRelayCheckCache,
                recipientRelayResolutionCache,
            }, recipientPubkey);
        } catch (error) {
            logAppEvent({
                name: "messaging.dm.send.recipient_relay_discovery_failed",
                level: "warn",
                scope: { feature: "messaging", action: "send_dm" },
                context: {
                    peerPubkey: recipientPubkey.slice(0, 16),
                    reason: error instanceof Error ? error.message : "Recipient relay discovery failed",
                },
            });
            discoveredRecipientRelayUrls = [];
        }

        const privacySettings = PrivacySettingsService.getSettings();
        const rolloutPolicy = getV090RolloutPolicy(privacySettings);
        const usedCreatedAt = Math.floor(Date.now() / 1000);
        const tags: string[][] = [['p', recipientPubkey]];
        const recipientInboundRelayUrls = peerRelayEvidenceStore.getRelayUrls(recipientPubkey, profileId);
        const configuredSenderRelayUrls = typeof pool.getWritableRelaySnapshot === "function"
            ? pool.getWritableRelaySnapshot().configuredRelayUrls
            : pool.connections.map((connection) => connection.url);
        const senderWriteRelayUrls = dedupeRelayUrls([
            ...nip65Service.getWriteRelays(myPublicKeyHex),
            ...configuredSenderRelayUrls,
        ]);
        if (replyTo) tags.push(['e', replyTo, '', 'reply']);
        const protocolTags = await resolveProtocolEnvelopeTags(recipientPubkey);
        const combinedTags = [...tags, ...(customTags || []), ...protocolTags.map((tag) => [...tag])];
        let relaySendSnapshot = getLiveRelaySendSnapshot(pool);
        const relayTargeting = resolveTargetRelayUrls({
            customTags,
            discoveredRecipientRelayUrls,
            senderOpenRelayUrls: relaySendSnapshot.writableRelayUrls,
            senderWriteRelayUrls,
            recipientWriteRelayUrls: nip65Service.getWriteRelays(recipientPubkey),
            recipientInboundRelayUrls,
        });
        const targetRelayUrls = relayTargeting.targetRelayUrls;
        lastRelayScopeSource = relayTargeting.relayScopeSource;
        lastTargetRelayUrls = targetRelayUrls;
        logAppEvent({
            name: relayTargeting.lifecycleTag
                ? "messaging.transport.scope.connection_lifecycle"
                : "messaging.transport.scope.dm",
            level: relayTargeting.lifecycleTag && relayTargeting.recipientScopeRelayUrls.length === 0 ? "warn" : "info",
            scope: { feature: "messaging", action: "send_dm" },
            context: {
                peerPubkey: recipientPubkey.slice(0, 16),
                lifecycleTag: relayTargeting.lifecycleTag,
                discoveredRecipientRelayCount: discoveredRecipientRelayUrls.length,
                recipientScopeRelayCount: relayTargeting.recipientScopeRelayUrls.length,
                recipientInboundRelayCount: recipientInboundRelayUrls.length,
                recipientScopeSource: relayTargeting.relayScopeSource,
                senderOpenRelayCount: relaySendSnapshot.writableRelayUrls.length,
                senderConfiguredRelayCount: configuredSenderRelayUrls.length,
                targetRelayCount: targetRelayUrls.length,
                targetRelayPreview: targetRelayUrls.slice(0, 4).join(",") || null,
                recipientScopeOnly: relayTargeting.usedRecipientScopeOnly,
            }
        });
        const preferredFormat: DmFormat = shouldPreferLegacyDmFormat({
            customTags,
            useModernDMs: privacySettings.useModernDMs,
            hasPublishToAll: typeof pool.publishToAll === "function",
            stabilityModeEnabled: rolloutPolicy.stabilityModeEnabled,
            protocolCoreEnabled: rolloutPolicy.protocolCoreEnabled,
            preferModernGiftWrap: hasNativeRuntime(),
        })
            ? "nip04"
            : "nip17";

        let build: DmEventBuildResult;
        try {
            build = await buildDmEvent({
                format: preferredFormat, plaintext: cleanedPlaintext, recipientPubkey,
                senderPubkey: myPublicKeyHex, senderPrivateKeyHex: myPrivateKeyHex,
                createdAtUnixSeconds: usedCreatedAt, tags: combinedTags
            });
        } catch (buildError) {
            if (preferredFormat === "nip17") {
                build = await buildDmEvent({
                    format: "nip04", plaintext: cleanedPlaintext, recipientPubkey,
                    senderPubkey: myPublicKeyHex, senderPrivateKeyHex: myPrivateKeyHex,
                    createdAtUnixSeconds: usedCreatedAt, tags: combinedTags
                });
            } else throw buildError;
        }

        const prepared = await prepareOutgoingDm({
            build, plaintext: cleanedPlaintext, createdAtUnixSeconds: usedCreatedAt,
            myPublicKeyHex, recipientPubkey, replyTo,
            messageKind: resolveOutgoingMessageKind(customTags),
            attachments: attachments ? [...attachments] : undefined,
            maxMessagesInMemory, extractAttachmentsFromContent,
            messageQueue, setState, createReadyState, messageMemoryManager,
            getExistingMessagesForOptimisticInsert: (prev: EnhancedDMControllerState) => prev.messages,
            pendingMessages: pendingMessages.current, relayRequestTimes: relayRequestTimes.current
        });

        if (relaySendSnapshot.openRelayCount === 0) {
            const scopedWaitRelayUrls = targetRelayUrls.length > 0
                ? targetRelayUrls
                : configuredSenderRelayUrls;
            if (scopedWaitRelayUrls.length > 0) {
                if (typeof pool.waitForScopedConnection === "function") {
                    await pool.waitForScopedConnection(scopedWaitRelayUrls, 3_000);
                } else {
                    await pool.waitForConnection(3_000);
                }
            } else {
                await pool.waitForConnection(3_000);
            }
            relaySendSnapshot = getLiveRelaySendSnapshot(pool);
        }

        let scopedWritableRelayUrls = targetRelayUrls.length > 0
            ? getScopedWritableRelayUrls({ pool, targetRelayUrls })
            : relaySendSnapshot.writableRelayUrls;
        let scopedTargetRelayCount = targetRelayUrls.length > 0
            ? targetRelayUrls.length
            : relaySendSnapshot.writableRelayUrls.length;
        const transportTag = getTransportTag(customTags);
        const realtimeVoiceTransport = isRealtimeVoiceTransportTag(transportTag);
        const isDeleteCommand = transportTag === "message-delete";
        if (isDeleteCommand && scopedWritableRelayUrls.length === 0 && relayTargeting.usedRecipientScopeOnly) {
            const senderFallbackRelayUrls = relaySendSnapshot.writableRelayUrls;
            if (senderFallbackRelayUrls.length > 0) {
                scopedWritableRelayUrls = senderFallbackRelayUrls;
                scopedTargetRelayCount = senderFallbackRelayUrls.length;
                console.log("[DeleteForEveryone:relay-fallback] Recipient-scoped relays unavailable, falling back to sender relays", {
                    recipientPubkey: recipientPubkey.slice(0, 16),
                    senderRelayCount: senderFallbackRelayUrls.length,
                });
            }
        }
        const requiredRelaySuccessMinimum = realtimeVoiceTransport
            ? 1
            : getDurableRelaySuccessMinimum(Math.max(1, scopedTargetRelayCount));
        const relayPreflightDecision = resolveRelayPreflightDecision({
            openRelayCount: relaySendSnapshot.openRelayCount,
            scopedWritableRelayCount: scopedWritableRelayUrls.length,
            durableRelayMinimum: requiredRelaySuccessMinimum,
        });

        if (relayPreflightDecision === "queue_no_writable_relays") {
            const retryAt = messageQueue
                ? await queueOutgoingDmForRetry({
                    messageQueue,
                    messageId: prepared.messageId,
                    conversationId: prepared.conversationId,
                    plaintext: cleanedPlaintext,
                    recipientPubkey,
                    signedEvent: build.signedEvent,
                    targetRelayUrls,
                })
                : undefined;
            const errorMessage = "No writable relay snapshot available. Message queued and will retry automatically when connection returns.";
            deliveryDiagnosticsStore.markPublish({
                peerPublicKeyHex: recipientPubkey,
                eventId: prepared.messageId,
                relayUrls: targetRelayUrls,
                relayScopeSource: relayTargeting.relayScopeSource,
                deliveryStatus: "queued_retrying",
                success: false,
                reasonCode: "no_writable_relays",
                error: errorMessage,
            });
            reportSenderDeliveryIssue({
                senderPublicKeyHex: myPublicKeyHex,
                recipientPublicKeyHex: recipientPubkey,
                messageId: prepared.messageId,
                deliveryStatus: "queued_retrying",
                failureReason: "no_active_relays",
                reasonCode: "no_writable_relays",
                error: errorMessage,
                relayScopeSource: relayTargeting.relayScopeSource,
                targetRelayUrls,
            });
            return {
                success: false,
                deliveryStatus: "queued_retrying",
                retryAtUnixMs: retryAt?.getTime(),
                messageId: prepared.messageId,
                relayResults: [],
                error: errorMessage,
                failureReason: "no_active_relays"
            };
        }

        if (relayPreflightDecision === "attempt_degraded") {
            logAppEvent({
                name: "messaging.transport.preflight_insufficient_writable_relays",
                level: "warn",
                scope: { feature: "messaging", action: "send_dm" },
                context: {
                    peerPubkey: recipientPubkey.slice(0, 16),
                    targetRelayCount: scopedTargetRelayCount,
                    writableRelayCount: scopedWritableRelayUrls.length,
                    durableRelayMinimum: requiredRelaySuccessMinimum,
                    transportTag,
                },
            });
        }

        const { finalMessage, publishResult, updatedSignedEvent } = await publishOutgoingDm({
            pool,
            openRelays: relaySendSnapshot.writableRelayUrls.map((url) => ({ url })),
            targetRelayUrls,
            messageQueue,
            initialMessage: prepared.initialMessage,
            build, plaintext: cleanedPlaintext, recipientPubkey, senderPubkey: myPublicKeyHex,
            senderPrivateKeyHex: myPrivateKeyHex,
            createdAtUnixSeconds: usedCreatedAt,
            tags: combinedTags,
            requiredRelaySuccessMinimum,
        });

        if (updatedSignedEvent) {
            pendingMessages.current.delete(prepared.messageId);
            relayRequestTimes.current.delete(prepared.messageId);
            pendingMessages.current.set(finalMessage.id, finalMessage);
            relayRequestTimes.current.set(finalMessage.id, Date.now());
        }

        console.log("[DM:SEND:DIAG] publish complete", {
            messageId: finalMessage.id.slice(0, 16),
            status: finalMessage.status,
            publishSuccess: publishResult.success,
            successCount: publishResult.successCount,
            totalRelays: publishResult.totalRelays,
            reasonCode: publishResult.reasonCode ?? "none",
            format: finalMessage.dmFormat,
            targetRelayCount: targetRelayUrls.length,
            targetRelays: targetRelayUrls.slice(0, 4),
            relayResults: publishResult.results.map(r => ({ url: r.relayUrl.slice(0, 40), ok: r.success, err: r.error?.slice(0, 60) })),
            relayScopeSource: relayTargeting.relayScopeSource,
        });

        setState((prev: EnhancedDMControllerState) => {
            const updatedMessages = prev.messages.map((m: Message) => (m.id === (updatedSignedEvent ? prepared.messageId : finalMessage.id) ? finalMessage : m));
            return createReadyState(updatedMessages);
        });
        const deliveryStatus = resolveSendDeliveryStatus(publishResult, {
            queueRetryableFailures: transportTag === "message-delete",
        });
        const failureReason = publishResult.success
            ? undefined
            : publishResult.reasonCode === "no_writable_relays"
                ? "no_active_relays"
                : publishResult.reasonCode === "relay_degraded"
                    ? "quorum_not_met"
                : publishResult.reasonCode === "quorum_not_met"
                    ? "quorum_not_met"
                    : publishResult.reasonCode === "unsupported_runtime"
                        ? "unknown"
                        : "publish_rejected";
        deliveryDiagnosticsStore.markPublish({
            peerPublicKeyHex: recipientPubkey,
            eventId: finalMessage.eventId,
            relayUrls: targetRelayUrls,
            relayScopeSource: relayTargeting.relayScopeSource,
            deliveryStatus,
            success: publishResult.success,
            successCount: publishResult.successCount,
            totalRelays: publishResult.totalRelays,
            reasonCode: publishResult.reasonCode,
            error: publishResult.overallError,
        });
        if (!publishResult.success) {
            const issueDeliveryStatus = resolveSenderDeliveryIssueStatus({
                success: publishResult.success,
                successCount: publishResult.successCount,
            });
            reportSenderDeliveryIssue({
                senderPublicKeyHex: myPublicKeyHex,
                recipientPublicKeyHex: recipientPubkey,
                messageId: finalMessage.id,
                deliveryStatus: issueDeliveryStatus,
                failureReason: failureReason ?? "unknown",
                reasonCode: publishResult.reasonCode,
                error: publishResult.overallError,
                relayScopeSource: relayTargeting.relayScopeSource,
                targetRelayUrls,
                relayResults: publishResult.results,
            });
        }
        return {
            success: publishResult.success,
            deliveryStatus,
            messageId: finalMessage.id,
            relayResults: publishResult.results,
            error: publishResult.overallError,
            failureReason
        };
    } catch (error) {
        const msg = error instanceof Error && error.message
            ? error.message
            : 'Unexpected send failure. Check relay connectivity and try again.';
        deliveryDiagnosticsStore.markPublish({
            peerPublicKeyHex: recipientPubkey,
            relayUrls: lastTargetRelayUrls,
            relayScopeSource: lastRelayScopeSource,
            deliveryStatus: "failed",
            success: false,
            error: msg,
        });
        reportSenderDeliveryIssue({
            senderPublicKeyHex: myPublicKeyHex,
            recipientPublicKeyHex: recipientPubkey,
            deliveryStatus: "failed",
            failureReason: "unknown",
            error: msg,
            relayScopeSource: lastRelayScopeSource,
            targetRelayUrls: lastTargetRelayUrls,
        });
        setState((prev: EnhancedDMControllerState) => createErrorState(msg, prev.messages, errorHandler.handleUnknownError(error as Error)));
            return { success: false, deliveryStatus: "failed", messageId: '', relayResults: [], error: msg, failureReason: "unknown" };
    }
};

export const outgoingDmOrchestratorInternals = {
    shouldForceLegacyDmFormat,
    shouldPreferLegacyDmFormat,
    getConnectionLifecycleTag,
    resolveTargetRelayUrls,
    resolveRelayPreflightDecision,
    resolveSenderDeliveryIssueStatus,
    resolveSendDeliveryStatus,
};
