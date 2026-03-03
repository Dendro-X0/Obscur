import { NOSTR_SAFETY_LIMITS } from "@/app/features/relays/utils/nostr-safety-limits";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { buildDmEvent, type DmEventBuildResult, type DmFormat } from "./dm-event-builder";
import { prepareOutgoingDm } from "./outgoing-dm-send-preparer";
import { publishOutgoingDm, publishOutgoingDmFireAndForget, queueOutgoingDmForRetry } from "./outgoing-dm-publisher";
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

/**
 * Parameters for orchestrating the outgoing DM flow
 */
export interface OutgoingDmOrchestrationParams {
    peerPublicKeyInput: string;
    plaintext: string;
    replyTo?: string;
    customTags?: string[][];
    myPublicKeyHex: PublicKeyHex;
    myPrivateKeyHex: PrivateKeyHex;
    pool: RelayPool;
    messageQueue: MessageQueue | null;
    recipientRelayCheckCache: React.MutableRefObject<Set<string>>;
    pendingMessages: React.MutableRefObject<Map<string, Message>>;
    relayRequestTimes: React.MutableRefObject<Map<string, number>>;
    maxMessagesInMemory: number;
    setState: React.Dispatch<React.SetStateAction<EnhancedDMControllerState>>;
    createReadyState: (messages: ReadonlyArray<Message>) => EnhancedDMControllerState;
    createErrorState: (error: string, messages: ReadonlyArray<Message>, handledError: any) => EnhancedDMControllerState;
}

/**
 * Orchestrates the complete sending pipeline for a direct message
 */
export const orchestrateOutgoingDm = async (
    params: OutgoingDmOrchestrationParams
): Promise<SendResult> => {
    const {
        peerPublicKeyInput, plaintext, replyTo, customTags,
        myPublicKeyHex, myPrivateKeyHex, pool, messageQueue,
        recipientRelayCheckCache, pendingMessages, relayRequestTimes,
        maxMessagesInMemory, setState, createReadyState, createErrorState
    } = params;

    const networkCheck = errorHandler.canAttemptOperation();
    if (!networkCheck.canAttempt) {
        if (!errorHandler.getNetworkState().isOnline) errorHandler.handleNetworkOffline({ operation: 'sendMessage' });
        else errorHandler.handleAllRelaysFailed({ operation: 'sendMessage' });
    }

    const parsedRecipient = parsePublicKeyInput(peerPublicKeyInput);
    if (!parsedRecipient.ok) {
        const error = 'Invalid recipient public key';
        setState(prev => createErrorState(error, prev.messages, errorHandler.handleInvalidInput(error)));
        return { success: false, messageId: '', relayResults: [], error };
    }
    const recipientPubkey = parsedRecipient.publicKeyHex;

    await ensureConnectedToRecipientRelays({ pool, recipientRelayCheckCache }, recipientPubkey);
    applyRecipientRelayHints({
        peerPublicKeyInput,
        recipientPubkey,
        addTransientRelay: pool.addTransientRelay,
        getWriteRelays: (pubkey) => nip65Service.getWriteRelays(pubkey)
    });

    const cleanedPlaintext = plaintext.trim();
    if (cleanedPlaintext.length === 0) return { success: false, messageId: '', relayResults: [], error: 'Message cannot be empty' };
    if (cleanedPlaintext.length > NOSTR_SAFETY_LIMITS.maxDmPlaintextChars) {
        const error = `Message is too long (max ${NOSTR_SAFETY_LIMITS.maxDmPlaintextChars} chars)`;
        setState(prev => createErrorState(error, prev.messages, errorHandler.handleInvalidInput(error)));
        return { success: false, messageId: '', relayResults: [], error };
    }

    try {
        const privacySettings = PrivacySettingsService.getSettings();
        const usedCreatedAt = Math.floor(Date.now() / 1000);
        const tags: string[][] = [['p', recipientPubkey]];
        if (replyTo) tags.push(['e', replyTo, '', 'reply']);
        const combinedTags = [...tags, ...(customTags || [])];
        const openRelays = pool.connections.filter(c => c.status === 'open');
        const preferredFormat: DmFormat = privacySettings.useModernDMs && typeof pool.publishToAll === "function" ? "nip17" : "nip04";

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
            maxMessagesInMemory, extractAttachmentsFromContent,
            messageQueue, setState, createReadyState, messageMemoryManager,
            getExistingMessagesForOptimisticInsert: (prev: EnhancedDMControllerState) => prev.messages,
            pendingMessages: pendingMessages.current, relayRequestTimes: relayRequestTimes.current
        });

        if (openRelays.length === 0) {
            if (messageQueue) await queueOutgoingDmForRetry({ messageQueue, messageId: prepared.messageId, conversationId: prepared.conversationId, plaintext: cleanedPlaintext, recipientPubkey, signedEvent: build.signedEvent });
            return { success: false, messageId: prepared.messageId, relayResults: [], error: 'Offline - message queued' };
        }

        if (pool.publishToAll) {
            const { finalMessage, publishResult, updatedSignedEvent } = await publishOutgoingDm({
                pool, openRelays, messageQueue, initialMessage: prepared.initialMessage,
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
            return { success: publishResult.success, messageId: finalMessage.id, relayResults: publishResult.results, error: publishResult.overallError };
        } else {
            const { relayResults } = publishOutgoingDmFireAndForget({ pool, openRelays, signedEvent: build.signedEvent });
            const acceptedMessage: Message = {
                ...prepared.initialMessage,
                status: "accepted",
                relayResults
            };

            if (messageQueue) {
                await messageQueue.updateMessageStatus(prepared.messageId, "accepted");
            }

            setState((prev: EnhancedDMControllerState) => {
                const updatedMessages = prev.messages.map((m: Message) => (
                    m.id === prepared.messageId ? acceptedMessage : m
                ));
                return createReadyState(updatedMessages);
            });

            return { success: true, messageId: prepared.messageId, relayResults };
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        setState((prev: EnhancedDMControllerState) => createErrorState(msg, prev.messages, errorHandler.handleUnknownError(error as Error)));
        return { success: false, messageId: '', relayResults: [], error: msg };
    }
};
