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
import type { Attachment } from "../types";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { protocolCoreAdapter } from "@/app/features/runtime/protocol-core-adapter";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { RelaySendSnapshot } from "@/app/features/search/types/discovery";
import { deliveryDiagnosticsStore } from "../services/delivery-diagnostics-store";
import { reportSenderDeliveryIssue } from "../services/delivery-troubleshooting-reporter";
import { peerRelayEvidenceStore } from "../services/peer-relay-evidence-store";

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

const dedupeRelayUrls = (relayUrls: ReadonlyArray<string>): ReadonlyArray<string> => (
    Array.from(new Set(relayUrls.map((url) => url.trim()).filter((url) => url.length > 0)))
);

type RecipientRelayScopeSource =
    | "recipient_discovery"
    | "recipient_write_relays"
    | "peer_inbound_evidence"
    | "sender_fallback";

export const resolveTargetRelayUrls = (params: Readonly<{
    customTags?: ReadonlyArray<ReadonlyArray<string>>;
    discoveredRecipientRelayUrls: ReadonlyArray<string>;
    senderOpenRelayUrls: ReadonlyArray<string>;
    senderWriteRelayUrls: ReadonlyArray<string>;
    recipientWriteRelayUrls: ReadonlyArray<string>;
    recipientInboundRelayUrls: ReadonlyArray<string>;
}>): Readonly<{
    lifecycleTag: string | null;
    targetRelayUrls: ReadonlyArray<string>;
    recipientScopeRelayUrls: ReadonlyArray<string>;
    recipientScopeSources: ReadonlyArray<RecipientRelayScopeSource>;
    relayScopeSource: RecipientRelayScopeSource | "mixed_recipient_scope";
    usedRecipientScopeOnly: boolean;
}> => {
    const lifecycleTag = getConnectionLifecycleTag(params.customTags);
    const recipientScopeSources: RecipientRelayScopeSource[] = [];
    if (params.discoveredRecipientRelayUrls.length > 0) {
        recipientScopeSources.push("recipient_discovery");
    }
    if (params.recipientWriteRelayUrls.length > 0) {
        recipientScopeSources.push("recipient_write_relays");
    }
    if (params.recipientInboundRelayUrls.length > 0) {
        recipientScopeSources.push("peer_inbound_evidence");
    }
    const recipientScopeRelayUrls = dedupeRelayUrls([
        ...params.discoveredRecipientRelayUrls,
        ...params.recipientWriteRelayUrls,
        ...params.recipientInboundRelayUrls,
    ]);
    const relayScopeSource = recipientScopeSources.length === 0
        ? "sender_fallback"
        : recipientScopeSources.length === 1
            ? recipientScopeSources[0]
            : "mixed_recipient_scope";

    if (lifecycleTag) {
        if (recipientScopeRelayUrls.length > 0) {
            return {
                lifecycleTag,
                targetRelayUrls: dedupeRelayUrls([
                    ...recipientScopeRelayUrls,
                    ...params.senderOpenRelayUrls,
                    ...params.senderWriteRelayUrls,
                ]),
                recipientScopeRelayUrls,
                recipientScopeSources,
                relayScopeSource,
                usedRecipientScopeOnly: false,
            };
        }

        return {
            lifecycleTag,
            targetRelayUrls: dedupeRelayUrls([
                ...params.senderOpenRelayUrls,
                ...params.senderWriteRelayUrls,
            ]),
            recipientScopeRelayUrls,
            recipientScopeSources,
            relayScopeSource,
            usedRecipientScopeOnly: false,
        };
    }

    return {
        lifecycleTag: null,
        targetRelayUrls: dedupeRelayUrls([
            ...recipientScopeRelayUrls,
            ...params.senderOpenRelayUrls,
            ...params.senderWriteRelayUrls,
        ]),
        recipientScopeRelayUrls,
        recipientScopeSources,
        relayScopeSource,
        usedRecipientScopeOnly: false,
    };
};

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
        maxMessagesInMemory, setState, createReadyState, createErrorState
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
        const recipientInboundRelayUrls = peerRelayEvidenceStore.getRelayUrls(recipientPubkey);
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

        const scopedWritableRelayUrls = targetRelayUrls.length > 0
            ? getScopedWritableRelayUrls({ pool, targetRelayUrls })
            : relaySendSnapshot.writableRelayUrls;
        const scopedTargetRelayCount = targetRelayUrls.length > 0
            ? targetRelayUrls.length
            : relaySendSnapshot.writableRelayUrls.length;
        const durableRelayMinimum = getDurableRelaySuccessMinimum(Math.max(1, scopedTargetRelayCount));
        const relayPreflightDecision = resolveRelayPreflightDecision({
            openRelayCount: relaySendSnapshot.openRelayCount,
            scopedWritableRelayCount: scopedWritableRelayUrls.length,
            durableRelayMinimum,
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
                    durableRelayMinimum,
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
            senderPrivateKeyHex: myPrivateKeyHex, createdAtUnixSeconds: usedCreatedAt, tags: combinedTags
        });

        if (updatedSignedEvent) {
            pendingMessages.current.delete(prepared.messageId);
            relayRequestTimes.current.delete(prepared.messageId);
            pendingMessages.current.set(finalMessage.id, finalMessage);
            relayRequestTimes.current.set(finalMessage.id, Date.now());
        }

        setState((prev: EnhancedDMControllerState) => {
            const updatedMessages = prev.messages.map((m: Message) => (m.id === (updatedSignedEvent ? prepared.messageId : finalMessage.id) ? finalMessage : m));
            return createReadyState(updatedMessages);
        });
        const deliveryStatus = publishResult.status === "queued"
            ? "queued_retrying"
            : publishResult.status === "partial"
                ? "sent_partial"
                : publishResult.success
                    ? "sent_quorum"
                    : "failed";
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
};
