/**
 * dm-controller.ts (v2)
 *
 * Thin React hook that composes the send/receive/delete pipelines.
 * Owns: React state, subscription lifecycle, message list management.
 * Delegates all business logic to pipeline modules.
 *
 * Replaces: enhanced-dm-controller.ts (58KB), outgoing-dm-orchestrator.ts,
 * outgoing-dm-publisher.ts, dm-subscription-manager.ts, relay-ok-message-handler.ts.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message, Attachment, MessageStatus } from "@/app/features/messaging/types";
import type {
  RelayPoolContract,
  SendResult,
  BlocklistContract,
  PeerTrustContract,
  RequestsInboxContract,
  DmControllerState,
} from "./dm-controller-types";
import { toast } from "@dweb/ui-kit";
import { sendDm, sendConnectionRequest, type SendConfirmation } from "./dm-send-pipeline";
import { getRelayPublishFailureUserMessage } from "@/app/features/relays/services/relay-publish-user-copy";
import { processIncomingEvent, processDeleteEventDirect, createDedupSet, type IncomingDmResult } from "./dm-receive-pipeline";
// deleteMessages replaced by new deletion coordinator
import { subscribeToIncomingDMs, type SubscriptionHandle } from "./dm-relay-transport";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { executeDmDeleteForMe } from "../../services/dm-local-delete-persistence";
// Delete-for-everyone + remote ingest
import {
  deleteMessageForEveryone,
  commitNetworkDeleteTombstone,
  updateNetworkTombstoneEvidence,
  resolveMessageIdentity,
} from "../../deletion";
import { logAppEvent } from "@/app/shared/log-app-event";
// DM Ledger shadow mode - divergence detection only, no behavior change
import { checkDmDivergence, recordDmMessage, recordDmDelete } from "../../dm-ledger";
import { appendCanonicalDmEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import { peerRelayEvidenceStore } from "../../services/peer-relay-evidence-store";
import { messagingClientOperations } from "../../services/messaging-client-operations";
import { collectMessageIdentityAliases } from "../../services/message-identity-alias-contract";
import { toDmConversationId } from "../../utils/dm-conversation-id";
import { buildDeleteTargetIdsForDm } from "../../services/dm-delete-target-derivation";
import { toAccountEventPlaintextPreview } from "@/app/features/account-sync/services/account-event-plaintext-preview";
import { applyDmThreadRedaction } from "../../services/apply-dm-thread-redaction";
import { applyDmRedactionDisplayGate } from "../../services/dm-redaction-display-gate";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGES_IN_MEMORY = 200;

const isNostrEventId = (value: string | undefined): boolean => (
  typeof value === "string" && /^[0-9a-f]{64}$/i.test(value.trim())
);

// ---------------------------------------------------------------------------
// Hook params
// ---------------------------------------------------------------------------

export type UseDmControllerParams = Readonly<{
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
  pool: RelayPoolContract;
  blocklist?: BlocklistContract;
  peerTrust?: PeerTrustContract;
  requestsInbox?: RequestsInboxContract;
  onNewMessage?: (message: Message) => void;
  onMessageDeleted?: (params: Readonly<{
    conversationId: string;
    messageId: string;
    messageIdentityIds?: ReadonlyArray<string>;
    conversationIdOriginal?: string;
  }>) => void;
  autoSubscribeIncoming?: boolean;
  enableIncomingTransport?: boolean;
  transportOwnerId?: string;
}>;

// ---------------------------------------------------------------------------
// Hook result — matches UseEnhancedDMControllerResult for drop-in compatibility
// ---------------------------------------------------------------------------

export type UseDmControllerResult = Readonly<{
  state: DmControllerState & {
    status: "initializing" | "ready" | "error";
    subscriptions: ReadonlyArray<{ id: string; isActive: boolean }>;
    messageStatusMap: Readonly<Record<string, MessageStatus>>;
    networkState: { online: boolean };
  };
  sendDm: (params: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    attachments?: ReadonlyArray<Attachment>;
    replyTo?: string;
    customTags?: string[][];
  }>) => Promise<SendResult>;
  sendConnectionRequest: (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    introMessage?: string;
  }>) => Promise<SendResult>;
  subscribeToIncomingDMs: () => void;
  unsubscribeFromDMs: () => void;
  deleteMessage: (params: Readonly<{
    messageId: string;
    conversationId: string;
    peerPublicKeyHex: PublicKeyHex;
    mode?: "for_me" | "for_everyone";
    /** Chat read-model snapshot when the message is not in transport memory. */
    messageHint?: Message;
    /** Full alias set (eventId, rumorId, local id) for network delete targeting. */
    targetIdentityIds?: ReadonlyArray<string>;
  }>) => Promise<boolean>;
  // Compatibility stubs for methods the old controller exposed
  retryFailedMessage: (messageId: string) => Promise<void>;
  getMessageStatus: (messageId: string) => MessageStatus | null;
  getMessagesByConversation: (conversationId: string) => ReadonlyArray<Message>;
  syncMissedMessages: (since?: Date) => Promise<void>;
  processOfflineQueue: () => Promise<void>;
  getOfflineQueueStatus: () => Promise<null>;
  verifyRecipient: (pubkeyHex: PublicKeyHex) => Promise<{ exists: boolean }>;
  watchConversation: (peerPubkey: string) => Promise<void>;
}>;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useDmController = (params: UseDmControllerParams): UseDmControllerResult => {
  const {
    myPublicKeyHex,
    myPrivateKeyHex,
    pool,
    blocklist,
    peerTrust,
    onNewMessage,
    onMessageDeleted,
    autoSubscribeIncoming = true,
    enableIncomingTransport = true,
  } = params;

  // --- State ---
  const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);
  const [error] = useState<string | undefined>();
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const subscriptionRef = useRef<SubscriptionHandle | null>(null);
  const subscribedRef = useRef(false);
  const messagesRef = useRef<ReadonlyArray<Message>>([]);
  const dedupSetRef = useRef<Set<string>>(createDedupSet());
  const publishFeedbackShownRef = useRef<Set<string>>(new Set());
  messagesRef.current = messages;
  const poolRef = useRelayPoolRef(pool);

  // --- Stable refs for subscription callback dependencies ---
  // These refs allow the subscription event handler to always read the latest
  // values without recreating the callback (which would cause unsubscribe/resubscribe
  // cycles and drop events during the gap).
  const myPublicKeyHexRef = useRef(myPublicKeyHex);
  myPublicKeyHexRef.current = myPublicKeyHex;
  const myPrivateKeyHexRef = useRef(myPrivateKeyHex);
  myPrivateKeyHexRef.current = myPrivateKeyHex;
  const blocklistRef = useRef(blocklist);
  blocklistRef.current = blocklist;
  const peerTrustRef = useRef(peerTrust);
  peerTrustRef.current = peerTrust;
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;
  const onMessageDeletedRef = useRef(onMessageDeleted);
  onMessageDeletedRef.current = onMessageDeleted;

  // --- Incoming event handler (stable reference via refs) ---
  const handleIncomingEvent = useCallback(async (event: NostrEvent, relayUrl: string) => {
    console.log("[dm-controller:v2] handleIncomingEvent", {
      eventId: event.id.slice(0, 16),
      kind: event.kind,
      relayUrl: relayUrl.slice(0, 32),
    });

    const applyRemoteDelete = async (
      deleteResult: Extract<IncomingDmResult, { action: "delete" }>,
      nostrEvent: NostrEvent,
    ): Promise<void> => {
      const { targetMessageIds, conversationId, plaintext } = deleteResult;
      const myPk = myPublicKeyHexRef.current;
      if (!myPk) {
        return;
      }

      const redactionResult = await applyDmThreadRedaction({
        nostrEvent,
        plaintext,
        targetMessageIds,
        conversationIdHint: conversationId,
        relayUrl,
        myPublicKeyHex: myPk,
        onRedactionApplied: (applied) => {
          onMessageDeletedRef.current?.(applied);
        },
      });

      if (redactionResult.status === "duplicate_skipped") {
        return;
      }

      if (redactionResult.resolvedIdentityIds.length > 0) {
        void recordDmDelete({
          conversationId: redactionResult.conversationId,
          targetIdentityIds: redactionResult.resolvedIdentityIds,
          deletedByPubkey: nostrEvent.pubkey as PublicKeyHex,
          isLocalDelete: nostrEvent.pubkey === myPk,
          source: "relay_live",
        }).catch((err) => {
          console.error("[dm-ledger:shadow] delete recording error", err);
        });
      }
    };

    const result = await processIncomingEvent({
      event,
      myPublicKeyHex: myPublicKeyHexRef.current ?? "",
      myPrivateKeyHex: myPrivateKeyHexRef.current ?? "",
      blocklist: blocklistRef.current,
      peerTrust: peerTrustRef.current,
      dedupSet: dedupSetRef.current,
    });

    console.log("[dm-controller:v2] process result", {
      action: result.action,
      reason: result.action === "skipped" ? result.reason : undefined,
    });
    logAppEvent({
      name: "messaging.delete_for_everyone_remote_result",
      level: result.action === "skipped" ? "warn" : "info",
      scope: { feature: "messaging", action: "delete_for_everyone" },
      context: {
        channel: "dm_process_result",
        resultCode: result.action,
        reasonCode: result.action === "skipped" ? result.reason : null,
        deliveryStatus: "received",
        conversationIdHint: result.action === "message" || result.action === "self_echo"
          ? result.message.conversationId?.slice(0, 32) ?? null
          : result.action === "delete"
            ? result.conversationId.slice(0, 32)
            : null,
        messageIdHint: result.action === "message" || result.action === "self_echo"
          ? result.message.id.slice(0, 16)
          : result.action === "delete"
            ? result.targetMessageIds[0]?.slice(0, 16) ?? null
            : null,
        conversationKind: "dm",
        isOutgoing: event.pubkey === myPublicKeyHexRef.current,
        deleteTargetCount: result.action === "delete" ? result.targetMessageIds.length : 0,
        remoteMessageIdHint: event.id.slice(0, 16),
      },
    });

    switch (result.action) {
      case "message": {
        const msg = result.message;
        const profileId = getResolvedProfileId();
        const nowMs = Date.now();
        if (messagingClientOperations.isDmMessageIdentitySuppressed(msg, profileId ?? undefined, nowMs)) {
          break;
        }
        if (!msg.isOutgoing && msg.senderPubkey) {
          peerRelayEvidenceStore.recordInboundRelay({
            peerPublicKeyHex: msg.senderPubkey,
            relayUrl,
            profileId: getResolvedProfileId(),
          });
        }
        // Pre-compute for ledger shadow mode (outside async to capture values)
        const msgConversationId = msg.conversationId || [myPublicKeyHex, msg.senderPubkey].sort().join(":");
        const msgIdentityIds = [msg.id, msg.eventId].filter((id): id is string => !!id);

        setMessages(prev => {
          // Dedup by event ID in state
          if (prev.some(m => m.eventId === msg.eventId || m.id === msg.id)) {
            return prev;
          }
          const next = [msg, ...prev]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, MAX_MESSAGES_IN_MEMORY);
          return next;
        });
        onNewMessageRef.current?.(msg);

        // Write to account projection so hydrateHistory has projection evidence
        // and restore cycles do not wipe this message from the UI.
        // Projection timeline keys must match hydrated/live DM rows (rumor id for NIP-17).
        // Using gift-wrap outer event.id here duplicates the same plaintext under two ids and breaks delete-for-everyone suppression merges.
        if (msg.senderPubkey && myPublicKeyHexRef.current && !msg.isOutgoing) {
          void appendCanonicalDmEvent({
            accountPublicKeyHex: myPublicKeyHexRef.current as PublicKeyHex,
            peerPublicKeyHex: msg.senderPubkey as PublicKeyHex,
            type: "DM_RECEIVED",
            conversationId: msgConversationId,
            messageId: msg.id,
            eventCreatedAtUnixSeconds: Math.floor((msg.timestamp?.getTime() ?? Date.now()) / 1000),
            plaintextPreview: toAccountEventPlaintextPreview(
              typeof msg.content === "string" ? msg.content : "",
            ),
          }).catch((err) => {
            console.error("[dm-controller:v2] appendCanonicalDmEvent DM_RECEIVED failed", err);
          });
        }

        // DM Ledger shadow mode: record operation
        void (async () => {
          try {
            await recordDmMessage({
              conversationId: msgConversationId,
              message: msg,
              identityIds: msgIdentityIds,
              senderPubkey: msg.senderPubkey as PublicKeyHex,
              isOutgoing: msg.isOutgoing,
              source: "relay_live",
              relayUrl,
              relayEventId: event.id,
            });
            // Note: divergence check moved to separate effect to avoid dependency issues
          } catch (err) {
            // Shadow mode errors shouldn't break anything
            console.error("[dm-ledger:shadow] error", err);
          }
        })();
        break;
      }

      case "self_echo": {
        const echo = result.message;
        const profileId = getResolvedProfileId();
        const nowMs = Date.now();
        if (messagingClientOperations.isDmMessageIdentitySuppressed(echo, profileId ?? undefined, nowMs)) {
          break;
        }
        setMessages(prev => {
          // Update existing outgoing message to "delivered" or add if not found
          const existingIdx = prev.findIndex(m =>
            m.eventId === echo.eventId || m.id === echo.id
          );
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = { ...prev[existingIdx], status: "delivered" };
            return updated;
          }
          // Self-echo from another device
          return [echo, ...prev]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, MAX_MESSAGES_IN_MEMORY);
        });
        break;
      }

      case "delete":
        await applyRemoteDelete(result, event);
        break;

      case "skipped":
        // No action needed (dedup recovery runs below when applicable)
        break;
    }

    if (result.action === "skipped" && result.reason === "dedup") {
      const pkRecover = myPublicKeyHexRef.current;
      const skRecover = myPrivateKeyHexRef.current;
      if (pkRecover && skRecover) {
        const directDelete = await processDeleteEventDirect({
          event,
          myPublicKeyHex: pkRecover,
          myPrivateKeyHex: skRecover,
        });
        if (directDelete.action === "delete") {
          await applyRemoteDelete(directDelete, event);
        }
      }
    }
  // Stable: refs provide fresh values without recreating callback
  }, [myPublicKeyHex]);

  // --- Subscribe ---
  const subscribe = useCallback(() => {
    if (!myPublicKeyHex || !enableIncomingTransport || subscribedRef.current) {
      console.log("[dm-controller:v2] subscribe skipped", {
        hasIdentity: !!myPublicKeyHex,
        transportEnabled: enableIncomingTransport,
        alreadySubscribed: subscribedRef.current,
      });
      return;
    }

    const activePool = poolRef.current;
    console.log("[dm-controller:v2] subscribing to incoming DMs", {
      myPubkey: myPublicKeyHex.slice(0, 16),
      openRelays: activePool.connections.filter(c => c.status === "open").length,
    });

    subscriptionRef.current = subscribeToIncomingDMs({
      pool: activePool,
      myPublicKeyHex,
      onEvent: handleIncomingEvent,
    });
    subscribedRef.current = true;
    setActiveSubId(subscriptionRef.current.id);
    console.log("[dm-controller:v2] subscribed", { subId: subscriptionRef.current.id });
  }, [poolRef, myPublicKeyHex, enableIncomingTransport, handleIncomingEvent]);

  const unsubscribe = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    subscribedRef.current = false;
    setActiveSubId(null);

  }, []);

  // --- Auto-subscribe ---
  // Only depends on identity + transport flags, NOT on handleIncomingEvent
  // (which is now stable via refs). This prevents unsubscribe/resubscribe
  // cycles that cause dropped incoming events.
  useEffect(() => {
    if (autoSubscribeIncoming && myPublicKeyHex && enableIncomingTransport) {
      subscribe();
    }
    return () => {
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubscribeIncoming, myPublicKeyHex, enableIncomingTransport]);

  // --- Send ---
  const sendDmAction = useCallback(async (sendParams: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    attachments?: ReadonlyArray<Attachment>;
    replyTo?: string;
    customTags?: string[][];
  }>): Promise<SendResult> => {
    if (!myPublicKeyHex || !myPrivateKeyHex) {
      return {
        success: false,
        deliveryStatus: "failed",
        messageId: "",
        eventId: "",
        relayResults: [],
        error: "Identity not unlocked",
      };
    }

    // Optimistic message
    const optimisticId = crypto.randomUUID();
    const isCommand = sendParams.plaintext.startsWith("__dweb_cmd__");
    const optimisticMessage: Message = {
      id: optimisticId,
      conversationId: [myPublicKeyHex, sendParams.peerPublicKeyInput].sort().join(":"),
      content: sendParams.plaintext,
      kind: isCommand ? "command" : "user",
      timestamp: new Date(),
      isOutgoing: true,
      status: "sending",
      senderPubkey: myPublicKeyHex,
      recipientPubkey: sendParams.peerPublicKeyInput,
    };

    // Add to state immediately (skip command messages - they should not appear in UI)
    if (!isCommand) {
      setMessages(prev => [optimisticMessage, ...prev].slice(0, MAX_MESSAGES_IN_MEMORY));
    }

    // Background confirmation handler — upgrades status after relay OK responses
    const handleConfirmed = (confirmation: SendConfirmation): void => {
      const confirmedStatus: MessageStatus = confirmation.success ? "accepted" : "failed";
      setMessages(prev =>
        prev.map(m =>
          m.id === optimisticId
            ? {
                ...m,
                status: confirmedStatus,
                relayResults: confirmation.relayResults.map(r => ({
                  relayUrl: r.relayUrl,
                  success: r.success,
                  error: r.error,
                  latency: r.latencyMs,
                })),
              }
            : m
        )
      );

      if (publishFeedbackShownRef.current.has(optimisticId)) {
        return;
      }
      publishFeedbackShownRef.current.add(optimisticId);

      if (!confirmation.success) {
        toast.error(getRelayPublishFailureUserMessage({
          reasonCode: confirmation.reasonCode,
          error: confirmation.error,
          successCount: confirmation.relayResults.filter(result => result.success).length,
          totalRelays: confirmation.relayResults.length,
          partialWireDelivery: confirmation.partialWireDelivery,
        }));
        return;
      }

      if (confirmation.partialWireDelivery) {
        toast.warning(getRelayPublishFailureUserMessage({
          partialWireDelivery: true,
        }));
      } else if (confirmation.deliveryStatus === "sent_partial") {
        toast.warning(getRelayPublishFailureUserMessage({
          reasonCode: "quorum_not_met",
          successCount: confirmation.relayResults.filter(result => result.success).length,
          totalRelays: confirmation.relayResults.length,
        }));
      }
    };

    // Execute send — returns immediately after sendToOpen (fire-and-forget).
    // Relay confirmations arrive asynchronously via handleConfirmed.
    const result = await sendDm({
      pool: poolRef.current,
      senderPublicKeyHex: myPublicKeyHex,
      senderPrivateKeyHex: myPrivateKeyHex,
      recipientPublicKeyHex: sendParams.peerPublicKeyInput,
      plaintext: sendParams.plaintext,
      customTags: sendParams.customTags?.map(t => [...t]),
      onConfirmed: handleConfirmed,
      dedupSet: dedupSetRef.current,
      profileId: getResolvedProfileId(),
    });

    // Update optimistic message with event ID from Phase 1 (instant).
    // CRITICAL: Do NOT replace m.id — changing the ID causes useDmSync to
    // treat the message as brand-new (different key), emitting a duplicate
    // messageBus event and leaving an orphan entry in IndexedDB.
    const immediateStatus: MessageStatus = result.success ? "accepted" : "sending";
    const canonicalDmId = result.messageId || result.eventId || undefined;
    const nip17GiftWrapId = (
      result.messageId
      && result.eventId
      && result.messageId !== result.eventId
    )
      ? result.eventId
      : undefined;
    setMessages(prev =>
      prev.map(m =>
        m.id === optimisticId
          ? {
              ...m,
              eventId: canonicalDmId,
              ...(nip17GiftWrapId ? { relayPublishedEventId: nip17GiftWrapId } : {}),
              status: immediateStatus,
            }
          : m
      )
    );

    // DM Ledger shadow mode: record outgoing message operation
    void (async () => {
      try {
        await recordDmMessage({
          conversationId: optimisticMessage.conversationId!, // Assert: always set for optimistic messages
          message: {
            ...optimisticMessage,
            eventId: canonicalDmId,
            ...(nip17GiftWrapId ? { relayPublishedEventId: nip17GiftWrapId } : {}),
            status: immediateStatus,
          },
          identityIds: [optimisticId, result.eventId, result.messageId].filter((id): id is string => !!id),
          senderPubkey: myPublicKeyHex,
          isOutgoing: true,
          source: "local_send",
        });
      } catch (err) {
        console.error("[dm-ledger:shadow] record outgoing message error", err);
      }
    })();

    // Write to account projection so the outgoing message has projection evidence.
    // This ensures restore cycles cannot wipe it from the UI before IndexedDB persistence.
    if (result.success && canonicalDmId && sendParams.peerPublicKeyInput) {
      void appendCanonicalDmEvent({
        accountPublicKeyHex: myPublicKeyHex,
        peerPublicKeyHex: sendParams.peerPublicKeyInput as PublicKeyHex,
        type: "DM_SENT_CONFIRMED",
        conversationId: optimisticMessage.conversationId!,
        messageId: canonicalDmId,
        eventCreatedAtUnixSeconds: Math.floor(Date.now() / 1000),
        plaintextPreview: toAccountEventPlaintextPreview(sendParams.plaintext),
      }).catch((err) => {
        console.error("[dm-controller:v2] appendCanonicalDmEvent DM_SENT_CONFIRMED failed", err);
      });
    }

    return {
      ...result,
      messageId: optimisticId,
    };
  }, [poolRef, myPublicKeyHex, myPrivateKeyHex]);

  // --- Send connection request ---
  const sendConnectionRequestAction = useCallback(async (reqParams: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    introMessage?: string;
  }>): Promise<SendResult> => {
    if (!myPublicKeyHex || !myPrivateKeyHex) {
      return {
        success: false,
        deliveryStatus: "failed",
        messageId: "",
        eventId: "",
        relayResults: [],
        error: "Identity not unlocked",
      };
    }

    return sendConnectionRequest({
      pool: poolRef.current,
      senderPublicKeyHex: myPublicKeyHex,
      senderPrivateKeyHex: myPrivateKeyHex,
      peerPublicKeyHex: reqParams.peerPublicKeyHex,
      introMessage: reqParams.introMessage,
    });
  }, [poolRef, myPublicKeyHex, myPrivateKeyHex]);

  // --- Delete ---
  const deleteMessageAction = useCallback(async (delParams: Readonly<{
    messageId: string;
    conversationId: string;
    peerPublicKeyHex: PublicKeyHex;
    mode?: "for_me" | "for_everyone"; // Defaults to "for_everyone" for own messages
    messageHint?: Message;
    targetIdentityIds?: ReadonlyArray<string>;
  }>) => {
    const mode = delParams.mode ?? "for_everyone";
    if (!myPublicKeyHex || !myPrivateKeyHex) return false;

    const profileId = getResolvedProfileId();
    const canonicalConversationId = toDmConversationId({
      myPublicKeyHex,
      peerPublicKeyHex: delParams.peerPublicKeyHex,
    }) ?? delParams.conversationId;
    if (!profileId) {
      console.warn("[dm-controller:v2] delete failed - no active profile");
      logAppEvent({
        name: "messaging.delete_for_everyone_rejected",
        level: "warn",
        scope: { feature: "messaging", action: "delete_for_everyone" },
        context: {
          reasonCode: "no_active_profile",
          conversationIdHint: canonicalConversationId.slice(0, 32),
          messageIdHint: delParams.messageId.slice(0, 16),
          conversationKind: "dm",
          isOutgoing: false,
          hasVoiceNoteAttachment: false,
        },
      });
      return false;
    }

    const hint = delParams.messageHint;
    const target = messages.find(
      (m: Message) => m.id === delParams.messageId || m.eventId === delParams.messageId,
    ) ?? (
      hint && (hint.id === delParams.messageId || hint.eventId === delParams.messageId)
        ? hint
        : undefined
    );

    const allTargetIdSet = new Set<string>([delParams.messageId]);
    if (target) {
      allTargetIdSet.add(target.id);
      if (target.eventId) {
        allTargetIdSet.add(target.eventId);
      }
    }
    if (hint) {
      collectMessageIdentityAliases(hint).forEach((id) => allTargetIdSet.add(id));
    }
    (delParams.targetIdentityIds ?? []).forEach((id) => {
      const normalized = id.trim();
      if (normalized.length > 0) {
        allTargetIdSet.add(normalized);
      }
    });
    const messageForDerivedTargets = target ?? hint;
    if (messageForDerivedTargets) {
      const derivedTargets = await buildDeleteTargetIdsForDm({
        message: messageForDerivedTargets,
        senderPubkey: myPublicKeyHex,
        recipientPubkey: delParams.peerPublicKeyHex,
      });
      for (const derivedId of derivedTargets) {
        const trimmedDerived = derivedId.trim();
        if (trimmedDerived.length > 0) {
          allTargetIdSet.add(trimmedDerived);
        }
      }
    }
    const allTargetIds = Array.from(allTargetIdSet);

    if (mode === "for_everyone" && profileId && allTargetIds.length > 0) {
      void applyDmRedactionDisplayGate({
        profileId,
        conversationId: canonicalConversationId,
        identityIds: allTargetIds,
        myPublicKeyHex,
        deleteAuthorPubkey: myPublicKeyHex,
      });
    }

    const senderPubkey = (
      target?.senderPubkey
      ?? hint?.senderPubkey
      ?? (hint?.isOutgoing ? myPublicKeyHex : undefined)
    );
    const networkEventId = (
      target?.eventId
      ?? hint?.eventId
      ?? (isNostrEventId(delParams.messageId) ? delParams.messageId : undefined)
    );

    // Build message identity
    const messageIdentity = resolveMessageIdentity({
      id: networkEventId ?? delParams.messageId,
      eventId: networkEventId,
      conversationId: canonicalConversationId,
      senderPubkey: senderPubkey || myPublicKeyHex,
      createdAt: target?.timestamp.getTime() ?? hint?.timestamp.getTime() ?? Date.now(),
      additionalIds: allTargetIds,
    });
    if (mode === "for_everyone") {
      console.info("[Obscur Recall] delete for everyone requested", {
        conversationId: canonicalConversationId.slice(0, 32),
        messageId: delParams.messageId.slice(0, 16),
        targetFound: !!target,
        hintProvided: !!hint,
        targetSenderPubkey: senderPubkey?.slice(0, 16) ?? null,
        myPublicKeyHex: myPublicKeyHex.slice(0, 16),
        peerPublicKeyHex: delParams.peerPublicKeyHex.slice(0, 16),
        allTargetIds: allTargetIds.map(id => id.slice(0, 16)),
        messageIdentityIds: messageIdentity.identityIds.map(id => id.slice(0, 16)),
        hasEventId: !!networkEventId,
      });
      logAppEvent({
        name: "messaging.delete_for_everyone_requested",
        level: "info",
        scope: { feature: "messaging", action: "delete_for_everyone" },
        context: {
          conversationIdHint: canonicalConversationId.slice(0, 32),
          messageIdHint: delParams.messageId.slice(0, 16),
          conversationKind: "dm",
          isOutgoing: senderPubkey === myPublicKeyHex,
          hasVoiceNoteAttachment: false,
        },
      });
    }

    if (mode === "for_me") {
      await executeDmDeleteForMe({
        conversationId: canonicalConversationId,
        messageIdentityIds: messageIdentity.identityIds,
        accountPublicKeyHex: myPublicKeyHex,
        profileId,
        observedAtUnixMs: target?.timestamp.getTime() ?? Date.now(),
      });
      setMessages((prev) => prev.filter((m) => (
        !allTargetIds.includes(m.id)
        && !allTargetIds.includes(m.eventId || "")
        && !(m.relayPublishedEventId && allTargetIds.includes(m.relayPublishedEventId))
      )));
      onMessageDeleted?.({
        conversationId: canonicalConversationId,
        messageId: delParams.messageId,
        messageIdentityIds: allTargetIds,
      });
      void recordDmDelete({
        conversationId: canonicalConversationId,
        targetIdentityIds: allTargetIds,
        deletedByPubkey: myPublicKeyHex,
        isLocalDelete: true,
        source: "local_delete",
      }).catch((err) => {
        console.error("[dm-ledger:shadow] record delete error", err);
      });
      return true;
    } else {
      if (mode !== "for_everyone") {
        return false;
      }
      const isMessageAuthor = hint?.isOutgoing === true || senderPubkey === myPublicKeyHex;
      if (!isMessageAuthor) {
        console.warn("[dm-controller:v2] delete for everyone rejected - not message author");
        logAppEvent({
          name: "messaging.delete_for_everyone_rejected",
          level: "warn",
          scope: { feature: "messaging", action: "delete_for_everyone" },
          context: {
            reasonCode: "not_message_author",
            conversationIdHint: canonicalConversationId.slice(0, 32),
            messageIdHint: delParams.messageId.slice(0, 16),
            conversationKind: "dm",
            isOutgoing: false,
            hasVoiceNoteAttachment: false,
          },
        });
        return false;
      }

      const prepared = await deleteMessageForEveryone({
        targetMessage: messageIdentity,
        profileId,
        conversationId: canonicalConversationId,
        myPublicKeyHex,
      }, { deferLocalTombstone: true });

      if (!prepared.success) {
        console.warn("[dm-controller:v2] delete command encoding failed", { error: prepared.error });
        logAppEvent({
          name: "messaging.delete_for_everyone_rejected",
          level: "warn",
          scope: { feature: "messaging", action: "delete_for_everyone" },
          context: {
            reasonCode: prepared.error,
            conversationIdHint: canonicalConversationId.slice(0, 32),
            messageIdHint: delParams.messageId.slice(0, 16),
            conversationKind: "dm",
            isOutgoing: true,
            hasVoiceNoteAttachment: false,
          },
        });
        return false;
      }

      logAppEvent({
        name: "messaging.delete_for_everyone_remote_result",
        level: "debug",
        scope: { feature: "messaging", action: "delete_for_everyone" },
        context: {
          channel: "dm_sender_plaintext_fingerprint",
          resultCode: prepared.commandPayload?.startsWith("__dweb_cmd__delete:")
            ? "delete_prefix_present"
            : prepared.commandPayload?.startsWith("__dweb_cmd__")
              ? "cmd_prefix_present"
              : "normal_plaintext",
          reasonCode: null,
          deliveryStatus: "local_redaction",
          conversationIdHint: canonicalConversationId.slice(0, 32),
          messageIdHint: delParams.messageId.slice(0, 16),
          conversationKind: "dm",
          isOutgoing: true,
          deleteTargetCount: allTargetIds.length,
          remoteMessageIdHint: null,
        },
      });

      await commitNetworkDeleteTombstone(prepared.tombstone);

      setMessages((prev) => prev.filter((m) => (
        !allTargetIds.includes(m.id)
        && !allTargetIds.includes(m.eventId || "")
        && !(m.relayPublishedEventId && allTargetIds.includes(m.relayPublishedEventId))
      )));
      onMessageDeleted?.({
        conversationId: canonicalConversationId,
        messageId: delParams.messageId,
        messageIdentityIds: allTargetIds,
      });

      void (async () => {
        try {
          const { applyDestructiveDmDeleteForEveryoneLocal } = await import(
            "../../services/dm-delete-for-everyone-local-destruction"
          );
          await applyDestructiveDmDeleteForEveryoneLocal({
            conversationId: canonicalConversationId,
            messageIdentityIds: allTargetIds,
            accountPublicKeyHex: myPublicKeyHex,
            profileId,
            observedAtUnixMs: prepared.tombstone.deletedAt,
            prioritizeUiResponse: true,
            replayProjection: true,
            redactTimelineEvents: true,
          });
        } catch (destructiveErr) {
          console.error("[dm-controller:v2] destructive local purge failed after recall UI", destructiveErr);
          logAppEvent({
            name: "messaging.delete_for_everyone_local_destruction_failed",
            level: "error",
            scope: { feature: "messaging", action: "delete_for_everyone" },
            context: {
              channel: "dm_sender_destructive_purge",
              conversationIdHint: canonicalConversationId.slice(0, 32),
              messageIdHint: delParams.messageId.slice(0, 16),
              reason: destructiveErr instanceof Error ? destructiveErr.message : String(destructiveErr),
            },
          });
        }
      })();

      const sendResult = await sendDm({
        pool: poolRef.current,
        senderPublicKeyHex: myPublicKeyHex,
        senderPrivateKeyHex: myPrivateKeyHex,
        recipientPublicKeyHex: delParams.peerPublicKeyHex,
        plaintext: prepared.commandPayload,
        customTags: [
          ["p", delParams.peerPublicKeyHex],
          ["t", "message-delete"],
          ...allTargetIds.map(id => ["e", id] as [string, string]),
        ],
        dedupSet: dedupSetRef.current,
        profileId: getResolvedProfileId(),
      });

      if (!sendResult.success) {
        console.warn("[dm-controller:v2] delete command publish failed (local redaction already applied)", sendResult.error);
        logAppEvent({
          name: "messaging.delete_for_everyone_remote_result",
          level: "warn",
          scope: { feature: "messaging", action: "delete_for_everyone" },
          context: {
            channel: "dm_sender_publish",
            resultCode: "failed_local_applied",
            reasonCode: sendResult.error ?? "publish_failed",
            deliveryStatus: sendResult.deliveryStatus,
            conversationIdHint: canonicalConversationId.slice(0, 32),
            messageIdHint: delParams.messageId.slice(0, 16),
            conversationKind: "dm",
            isOutgoing: true,
            deleteTargetCount: prepared.tombstone.targetMessageIdentityIds.length,
            remoteMessageIdHint: sendResult.eventId?.slice(0, 16) ?? null,
          },
        });
        return true;
      }

      const successfulRelay = sendResult.relayResults?.find(r => r.success)?.relayUrl;
      await updateNetworkTombstoneEvidence(
        prepared.tombstone.tombstoneId,
        profileId,
        sendResult.eventId,
        successfulRelay,
      );

      console.info("[Obscur Recall] delete command published to relay", {
        eventId: sendResult.eventId.slice(0, 16),
        tombstoneId: prepared.tombstone.tombstoneId.slice(0, 16),
        relayEvidence: successfulRelay?.slice(0, 40) ?? null,
        targetMessageIdentityIds: prepared.tombstone.targetMessageIdentityIds.map(id => id.slice(0, 16)),
      });
      logAppEvent({
        name: "messaging.delete_for_everyone_remote_result",
        level: "info",
        scope: { feature: "messaging", action: "delete_for_everyone" },
        context: {
          channel: "dm_sender_publish",
          resultCode: "success",
          reasonCode: null,
          deliveryStatus: sendResult.deliveryStatus,
          conversationIdHint: canonicalConversationId.slice(0, 32),
          messageIdHint: delParams.messageId.slice(0, 16),
          conversationKind: "dm",
          isOutgoing: true,
          deleteTargetCount: prepared.tombstone.targetMessageIdentityIds.length,
          remoteMessageIdHint: sendResult.eventId.slice(0, 16),
        },
      });

      void recordDmDelete({
        conversationId: canonicalConversationId,
        targetIdentityIds: allTargetIds,
        deletedByPubkey: myPublicKeyHex,
        isLocalDelete: false,
        source: "network_delete",
      }).catch((err) => {
        console.error("[dm-ledger:shadow] record delete error", err);
      });
      return true;
    }
  }, [poolRef, myPublicKeyHex, myPrivateKeyHex, onMessageDeleted, messages]);

  // --- State ---
  const messageStatusMap = useMemo(() => {
    const map: Record<string, MessageStatus> = {};
    messages.forEach(m => {
      if (m.id) map[m.id] = m.status;
      if (m.eventId) map[m.eventId] = m.status;
    });
    return map;
  }, [messages]);

  const state = useMemo(() => ({
    phase: (myPublicKeyHex ? "ready" : "idle") as "idle" | "ready" | "error",
    status: (myPublicKeyHex ? "ready" : "initializing") as "initializing" | "ready" | "error",
    messages,
    error,
    subscriptions: activeSubId
      ? [{ id: activeSubId, isActive: true }]
      : [],
    messageStatusMap,
    networkState: { online: typeof navigator !== "undefined" ? navigator.onLine : true },
  }), [myPublicKeyHex, messages, error, activeSubId, messageStatusMap]);

  // --- Compatibility stubs ---
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const retryFailedMessage = useCallback(async (_id: string) => {
    // TODO: implement retry from queue
  }, []);

  const getMessageStatus = useCallback((messageId: string): MessageStatus | null => {
    const found = messages.find(m => m.id === messageId || m.eventId === messageId);
    return found?.status ?? null;
  }, [messages]);

  const getMessagesByConversation = useCallback((conversationId: string): ReadonlyArray<Message> => {
    return messages.filter(m => m.conversationId === conversationId);
  }, [messages]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const syncMissedMessages = useCallback(async (_s?: Date) => {
    // TODO: implement sync
  }, []);

  const processOfflineQueue = useCallback(async () => {
    // TODO: implement offline queue
  }, []);

  const getOfflineQueueStatus = useCallback(async () => null, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const verifyRecipient = useCallback(async (_pk: PublicKeyHex) => ({ exists: true }), []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const watchConversation = useCallback(async (_pp: string) => {
    // Subscription already covers all DMs
  }, []);

  // DM Ledger shadow mode: check divergence when messages change
  // This runs periodically (throttled) to detect when existing state
  // differs from the canonical ledger projection
  useEffect(() => {
    // Skip if no messages or in SSR
    if (typeof window === "undefined" || messages.length === 0) return;

    // Debounce to avoid checking on every single message
    const timeout = setTimeout(() => {
      // Get unique conversation IDs from messages
      const conversationIds = new Set(messages.map(m => m.conversationId).filter(Boolean));

      // Check divergence for each conversation
      for (const conversationId of conversationIds) {
        if (!conversationId) continue;
        const convMessages = messages.filter(m => m.conversationId === conversationId);

        void checkDmDivergence({
          conversationId,
          existingMessages: convMessages,
          logDivergence: false, // We'll log custom output
        }).then(divergence => {
          if (divergence?.resurrectedInExisting.length) {
            console.warn("[dm-ledger:shadow] RESURRECTION DETECTED", {
              conversationId: conversationId.slice(0, 32),
              resurrectedCount: divergence.resurrectedInExisting.length,
              resurrectedIds: divergence.resurrectedInExisting.map(id => id.slice(0, 16)),
            });
          }
          if (divergence?.missingFromExisting.length) {
            console.log("[dm-ledger:shadow] missing messages in UI", {
              conversationId: conversationId.slice(0, 32),
              missingCount: divergence.missingFromExisting.length,
            });
          }
        }).catch(err => {
          console.error("[dm-ledger:shadow] divergence check error", err);
        });
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeout);
  }, [messages]);

  return {
    state,
    sendDm: sendDmAction,
    sendConnectionRequest: sendConnectionRequestAction,
    subscribeToIncomingDMs: subscribe,
    unsubscribeFromDMs: unsubscribe,
    deleteMessage: deleteMessageAction,
    retryFailedMessage,
    getMessageStatus,
    getMessagesByConversation,
    syncMissedMessages,
    processOfflineQueue,
    getOfflineQueueStatus,
    verifyRecipient,
    watchConversation,
  };
};
