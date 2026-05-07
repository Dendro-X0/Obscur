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
import { sendDm, sendConnectionRequest, type SendConfirmation } from "./dm-send-pipeline";
import { processIncomingEvent } from "./dm-receive-pipeline";
import { deleteMessages } from "./dm-delete-pipeline";
import { subscribeToIncomingDMs, type SubscriptionHandle } from "./dm-relay-transport";
import { suppressMessageDeleteTombstone } from "../../services/message-delete-tombstone-store";
// DM Ledger shadow mode - divergence detection only, no behavior change
import { checkDmDivergence, recordDmMessage, recordDmDelete } from "../../dm-ledger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGES_IN_MEMORY = 200;

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
  onMessageDeleted?: (params: Readonly<{ conversationId: string; messageId: string; messageIdentityIds?: ReadonlyArray<string> }>) => void;
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
  }>) => Promise<void>;
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
    const pubKey = myPublicKeyHexRef.current;
    const privKey = myPrivateKeyHexRef.current;
    if (!pubKey || !privKey) {
      console.warn("[dm-controller:v2] incoming event dropped — identity not available");
      return;
    }

    console.log("[dm-controller:v2] incoming event", {
      eventId: event.id?.slice(0, 16),
      kind: event.kind,
      from: event.pubkey?.slice(0, 16),
      relay: relayUrl?.slice(0, 40),
    });

    const result = await processIncomingEvent({
      event,
      relayUrl,
      ingestSource: "relay_live",
      myPublicKeyHex: pubKey,
      myPrivateKeyHex: privKey,
      blocklist: blocklistRef.current,
      peerTrust: peerTrustRef.current,
    });

    console.log("[dm-controller:v2] process result", {
      action: result.action,
      reason: result.action === "skipped" ? result.reason : undefined,
    });

    switch (result.action) {
      case "message": {
        const msg = result.message;
        // Pre-compute for ledger shadow mode (outside async to capture values)
        const msgConversationId = msg.conversationId || [pubKey, msg.senderPubkey].sort().join(":");
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

      case "self_echo":
        setMessages(prev => {
          // Update existing outgoing message to "delivered" or add if not found
          const existingIdx = prev.findIndex(m =>
            m.eventId === result.message.eventId || m.id === result.message.id
          );
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = { ...prev[existingIdx], status: "delivered" };
            return updated;
          }
          // Self-echo from another device
          return [result.message, ...prev]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, MAX_MESSAGES_IN_MEMORY);
        });
        break;

      case "delete": {
        const { targetMessageIds, conversationId } = result;
        console.log("[dm-controller:v2] delete action", {
          targetMessageIds: targetMessageIds.map(id => id.slice(0, 16)),
          conversationId: conversationId.slice(0, 32),
        });
        targetMessageIds.forEach(id => suppressMessageDeleteTombstone(id));
        setMessages(prev => {
          const matchedIds = prev
            .filter(m => targetMessageIds.includes(m.id) || targetMessageIds.includes(m.eventId || ""))
            .map(m => ({ id: m.id.slice(0, 16), eventId: m.eventId?.slice(0, 16) }));
          console.log("[dm-controller:v2] delete filter", {
            prevCount: prev.length,
            matchedCount: matchedIds.length,
            matchedIds,
          });
          return prev.filter(m => !targetMessageIds.includes(m.id) && !targetMessageIds.includes(m.eventId || ""));
        });
        // Emit a single delete event with ALL target IDs so the UI layer
        // can match against any identifier (UUID, eventId, rumor hash).
        if (targetMessageIds.length > 0) {
          onMessageDeletedRef.current?.({
            conversationId,
            messageId: targetMessageIds[0],
            messageIdentityIds: targetMessageIds,
          });
        }

        // DM Ledger shadow mode: record delete operation
        void (async () => {
          try {
            await recordDmDelete({
              conversationId,
              targetIdentityIds: targetMessageIds,
              deletedByPubkey: event.pubkey as PublicKeyHex,
              isLocalDelete: event.pubkey === pubKey,
              source: "relay_live",
            });
            // Divergence check moved to separate effect
          } catch (err) {
            console.error("[dm-ledger:shadow] delete recording error", err);
          }
        })();
        break;
      }

      case "skipped":
        // No action needed
        break;
    }
  // Stable: no external dependencies — all values read from refs
  }, []);

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

    console.log("[dm-controller:v2] subscribing to incoming DMs", {
      myPubkey: myPublicKeyHex.slice(0, 16),
      openRelays: pool.connections.filter(c => c.status === "open").length,
    });

    subscriptionRef.current = subscribeToIncomingDMs({
      pool,
      myPublicKeyHex,
      onEvent: handleIncomingEvent,
    });
    subscribedRef.current = true;
    setActiveSubId(subscriptionRef.current.id);
    console.log("[dm-controller:v2] subscribed", { subId: subscriptionRef.current.id });
  }, [pool, myPublicKeyHex, enableIncomingTransport, handleIncomingEvent]);

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

    // Add to state immediately
    setMessages(prev => [optimisticMessage, ...prev].slice(0, MAX_MESSAGES_IN_MEMORY));

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
    };

    // Execute send — returns immediately after sendToOpen (fire-and-forget).
    // Relay confirmations arrive asynchronously via handleConfirmed.
    const result = await sendDm({
      pool,
      senderPublicKeyHex: myPublicKeyHex,
      senderPrivateKeyHex: myPrivateKeyHex,
      recipientPublicKeyHex: sendParams.peerPublicKeyInput,
      plaintext: sendParams.plaintext,
      customTags: sendParams.customTags?.map(t => [...t]),
      onConfirmed: handleConfirmed,
    });

    // Update optimistic message with event ID from Phase 1 (instant).
    // CRITICAL: Do NOT replace m.id — changing the ID causes useDmSync to
    // treat the message as brand-new (different key), emitting a duplicate
    // messageBus event and leaving an orphan entry in IndexedDB.
    const immediateStatus: MessageStatus = result.success ? "accepted" : "failed";
    setMessages(prev =>
      prev.map(m =>
        m.id === optimisticId
          ? {
              ...m,
              eventId: result.eventId || undefined,
              status: immediateStatus,
            }
          : m
      )
    );

    return result;
  }, [pool, myPublicKeyHex, myPrivateKeyHex]);

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
      pool,
      senderPublicKeyHex: myPublicKeyHex,
      senderPrivateKeyHex: myPrivateKeyHex,
      peerPublicKeyHex: reqParams.peerPublicKeyHex,
      introMessage: reqParams.introMessage,
    });
  }, [pool, myPublicKeyHex, myPrivateKeyHex]);

  // --- Delete ---
  const deleteMessageAction = useCallback(async (delParams: Readonly<{
    messageId: string;
    conversationId: string;
    peerPublicKeyHex: PublicKeyHex;
  }>) => {
    if (!myPublicKeyHex || !myPrivateKeyHex) return;

    // Collect all identity aliases for the target message so removal covers
    // both the optimistic UUID and relay event ID.
    let allTargetIds: ReadonlyArray<string> = [delParams.messageId];
    setMessages(prev => {
      const target = prev.find(m => m.id === delParams.messageId || m.eventId === delParams.messageId);
      if (target) {
        const ids = new Set<string>();
        ids.add(target.id);
        if (target.eventId) ids.add(target.eventId);
        ids.add(delParams.messageId);
        allTargetIds = Array.from(ids);
      }
      return prev.filter(m => !allTargetIds.includes(m.id) && !allTargetIds.includes(m.eventId || ""));
    });

    onMessageDeleted?.({
      conversationId: delParams.conversationId,
      messageId: delParams.messageId,
      messageIdentityIds: allTargetIds,
    });

    // Publish delete command to peer
    await deleteMessages({
      pool,
      senderPublicKeyHex: myPublicKeyHex,
      senderPrivateKeyHex: myPrivateKeyHex,
      peerPublicKeyHex: delParams.peerPublicKeyHex,
      targetMessageIds: allTargetIds,
      conversationId: delParams.conversationId,
    });
  }, [pool, myPublicKeyHex, myPrivateKeyHex, onMessageDeleted]);

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
