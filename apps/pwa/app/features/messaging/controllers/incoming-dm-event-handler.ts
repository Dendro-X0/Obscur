import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import type { ConnectionRequestStatusValue } from "@/app/features/messaging/types";
import { errorHandler } from "../lib/error-handler";
import { extractAttachmentsFromContent } from "../utils/logic";
import type { Message, IMessageQueue } from "../lib/message-queue";
import type { Subscription } from "./dm-controller-state";
import type { Dispatch, SetStateAction } from "react";
import { cacheAttachmentLocally } from "../../vault/services/local-media-store";
import { logWithRateLimit } from "@/app/shared/log-hygiene";

const GLOBAL_PROCESSING_KEY = "__obscur_processing_dm_events__";
const GLOBAL_FAILED_DECRYPT_KEY = "__obscur_failed_decrypt_events__";

const getGlobalEventSet = (key: string): Set<string> => {
  const target = globalThis as Record<string, unknown>;
  const existing = target[key];
  if (existing instanceof Set) {
    return existing as Set<string>;
  }
  const next = new Set<string>();
  target[key] = next;
  return next;
};

export type IncomingDmParams = Readonly<{
  myPrivateKeyHex: string;
  myPublicKeyHex: PublicKeyHex;
  blocklist?: {
    isBlocked: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
  };
  peerTrust?: {
    isAccepted: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => boolean;
    acceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  };
  requestsInbox?: {
    upsertIncoming: (params: Readonly<{
      peerPublicKeyHex: PublicKeyHex;
      plaintext: string;
      createdAtUnixSeconds: number;
      isRequest?: boolean;
      status?: ConnectionRequestStatusValue;
      eventId?: string;
    }>) => void;
    getRequestStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => { status?: ConnectionRequestStatusValue; isOutgoing: boolean } | null;
    setStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>) => void;
  };
  onNewMessage?: (message: Message) => void;
  onConnectionCreated?: (pubkey: PublicKeyHex) => void;
}>;

export const handleIncomingDmEvent = async <TState extends Readonly<{ messages: ReadonlyArray<Message> }>>(params: Readonly<{
  event: NostrEvent;
  currentParams: IncomingDmParams;
  messageQueue: IMessageQueue | null;
  processingEvents: Set<string>;
  failedDecryptEvents: Set<string>;
  existingMessages: ReadonlyArray<Message>;
  maxMessagesInMemory: number;
  syncConversationTimestamps: Map<string, Date>;
  activeSubscriptions: Map<string, Subscription>;
  scheduleUiUpdate: (fn: () => void) => void;
  setState: Dispatch<SetStateAction<TState>>;
  createReadyState: (messages: ReadonlyArray<Message>) => TState;
  messageMemoryManager: { addMessages: (conversationId: string, messages: Message[]) => void };
  uiPerformanceMonitor: { startTracking: () => (() => { totalTime: number }) };
}>): Promise<void> => {
  const { event, currentParams } = params;
  const globalProcessingEvents = getGlobalEventSet(GLOBAL_PROCESSING_KEY);
  const globalFailedDecryptEvents = getGlobalEventSet(GLOBAL_FAILED_DECRYPT_KEY);

  const endTracking = params.uiPerformanceMonitor.startTracking();

  if (!currentParams.myPrivateKeyHex || !currentParams.myPublicKeyHex) {
    console.warn("Cannot process incoming message: identity not available");
    endTracking();
    return;
  }

  if (params.processingEvents.has(event.id) || globalProcessingEvents.has(event.id)) {
    console.debug("Already processing event:", event.id);
    endTracking();
    return;
  }

  if (params.failedDecryptEvents.has(event.id) || globalFailedDecryptEvents.has(event.id)) {
    console.debug("Skipping known undecryptable event:", event.id);
    endTracking();
    return;
  }

  const isDuplicateInMemory = params.existingMessages.some(m => m.eventId === event.id);
  if (isDuplicateInMemory) {
    console.debug("Ignoring duplicate message (in memory):", event.id);
    endTracking();
    return;
  }

  params.processingEvents.add(event.id);
  globalProcessingEvents.add(event.id);

  try {
    const isValidSignature = await cryptoService.verifyEventSignature(event);
    if (!isValidSignature) {
      console.warn("Rejected message with invalid signature:", event.id);
      return;
    }

    const senderPubkey = event.pubkey as PublicKeyHex;

    const recipientTag = event.tags?.find(tag => tag[0] === "p");
    if (!recipientTag || recipientTag[1] !== currentParams.myPublicKeyHex) {
      return;
    }

    if (currentParams.blocklist?.isBlocked({ publicKeyHex: senderPubkey })) {
      console.log("Filtered message from blocked sender:", senderPubkey);
      return;
    }

    let plaintext: string;
    let effectiveTags = event.tags;
    let actualSenderPubkey = senderPubkey;
    let usedEventId = event.id;
    let usedCreatedAt = event.created_at;

    try {
      if (event.kind === 1059) {
        const rumor = await cryptoService.decryptGiftWrap(event, currentParams.myPrivateKeyHex);
        // Never auto-join from an incoming invite payload. The UI invite card
        // must be explicitly accepted by the user before any local membership changes.
        plaintext = rumor.content;
        effectiveTags = rumor.tags;
        actualSenderPubkey = rumor.pubkey as PublicKeyHex;
        usedEventId = rumor.id;
        usedCreatedAt = rumor.created_at;
      } else {
        plaintext = await cryptoService.decryptDM(event.content, senderPubkey, currentParams.myPrivateKeyHex);
      }
    } catch (decryptError) {
      errorHandler.handleDecryptionError(
        decryptError instanceof Error ? decryptError : new Error("Decryption failed"),
        { eventId: event.id, sender: senderPubkey }
      );
      logWithRateLimit(
        "info",
        "incoming_dm.decrypt_failed",
        ["Info: Incoming message could not be decrypted (maybe intended for another key or malformed):", event.id],
        { windowMs: 10_000, maxPerWindow: 3, summaryEverySuppressed: 25 }
      );
      params.failedDecryptEvents.add(event.id);
      globalFailedDecryptEvents.add(event.id);
      if (params.failedDecryptEvents.size > 2000) {
        params.failedDecryptEvents.clear();
      }
      if (globalFailedDecryptEvents.size > 4000) {
        globalFailedDecryptEvents.clear();
      }
      return;
    }

    const isAcceptedContact = currentParams.peerTrust?.isAccepted({ publicKeyHex: actualSenderPubkey }) || false;
    const requestState = currentParams.requestsInbox?.getRequestStatus({ peerPublicKeyHex: actualSenderPubkey });
    const hasOutgoingPending = requestState?.isOutgoing && (requestState.status === "pending" || !requestState.status);

    const privacySettings = PrivacySettingsService.getSettings();
    if (privacySettings.dmPrivacy === "contacts-only" && !isAcceptedContact && !hasOutgoingPending) {
      console.log("Filtered message from stranger due to \"Connections Only\" privacy setting:", actualSenderPubkey);
      return;
    }

    const conversationId = [currentParams.myPublicKeyHex, actualSenderPubkey].sort().join(":");

    const message: Message = {
      id: usedEventId,
      conversationId,
      content: plaintext,
      kind: "user",
      timestamp: new Date(usedCreatedAt * 1000),
      isOutgoing: false,
      status: "delivered",
      eventId: usedEventId,
      eventCreatedAt: new Date(usedCreatedAt * 1000),
      senderPubkey: actualSenderPubkey,
      recipientPubkey: currentParams.myPublicKeyHex,
      encryptedContent: event.content,
      attachments: extractAttachmentsFromContent(plaintext)
    };

    if (message.attachments && message.attachments.length > 0) {
      void Promise.all(
        message.attachments.map((attachment) => cacheAttachmentLocally(attachment, "received"))
      ).catch((e) => {
        console.warn("[Vault] Failed to cache received attachments locally:", e);
      });
    }

    if (params.messageQueue) {
      const existingMessage = await params.messageQueue.getMessage(usedEventId);
      if (existingMessage) {
        console.debug("Ignoring duplicate message (found in storage):", usedEventId);
        return;
      }
    }

    if (params.messageQueue) {
      try {
        await params.messageQueue.persistMessage(message);
      } catch (storageError) {
        errorHandler.handleStorageError(
          storageError instanceof Error ? storageError : new Error("Failed to persist incoming message"),
          { eventId: event.id, sender: senderPubkey }
        );
        console.warn("Failed to persist incoming message:", storageError);
      }
    }

    const isConnectionRequest = effectiveTags?.some(tag => tag[0] === "t" && tag[1] === "connection-request");
    const isConnectionAccept = effectiveTags?.some(tag => tag[0] === "t" && tag[1] === "connection-accept");

    if (isConnectionAccept) {
      const rs = currentParams.requestsInbox?.getRequestStatus({ peerPublicKeyHex: actualSenderPubkey });
      const outgoingPending = !!(rs?.isOutgoing && (rs.status === "pending" || !rs.status));
      if (outgoingPending) {
        console.log("Detected connection-accept acknowledgement from:", actualSenderPubkey, ". Marking as accepted.");
        currentParams.peerTrust?.acceptPeer({ publicKeyHex: actualSenderPubkey });
        currentParams.requestsInbox?.setStatus({
          peerPublicKeyHex: actualSenderPubkey,
          status: "accepted",
          isOutgoing: true
        });
        currentParams.onConnectionCreated?.(actualSenderPubkey);
      }
    }

    if (!isAcceptedContact) {
      if (hasOutgoingPending) {
        console.log("Detected reply to outgoing connection request from:", actualSenderPubkey, ". Auto-accepting.");
        currentParams.peerTrust?.acceptPeer({ publicKeyHex: actualSenderPubkey });
        currentParams.requestsInbox?.upsertIncoming({
          peerPublicKeyHex: actualSenderPubkey,
          plaintext,
          createdAtUnixSeconds: usedCreatedAt,
          status: "accepted",
          eventId: usedEventId
        });
        currentParams.onConnectionCreated?.(actualSenderPubkey);
      } else {
        if (currentParams.requestsInbox) {
          currentParams.requestsInbox.upsertIncoming({
            peerPublicKeyHex: actualSenderPubkey,
            plaintext,
            createdAtUnixSeconds: usedCreatedAt,
            isRequest: isConnectionRequest,
            status: isConnectionRequest ? "pending" : undefined,
            eventId: usedEventId
          });
          console.log("Routed message from unknown sender to requests inbox:", actualSenderPubkey, { isRequest: isConnectionRequest });
        }
      }
    }

    params.syncConversationTimestamps.set(conversationId, message.timestamp);

    params.scheduleUiUpdate(() => {
      params.setState((prev: TState) => {
        const p = prev;
        const alreadyExists = p.messages.some((m: Message) => m.eventId === usedEventId);
        if (alreadyExists) {
          console.debug("Ignoring duplicate message (race condition caught):", usedEventId);
          return prev;
        }

        const updatedMessages: Message[] = [message, ...p.messages];
        const sortedMessages: Message[] = updatedMessages.sort((a: Message, b: Message) => b.timestamp.getTime() - a.timestamp.getTime());
        const limitedMessages: ReadonlyArray<Message> = sortedMessages.slice(0, params.maxMessagesInMemory);

        params.messageMemoryManager.addMessages(conversationId, [...limitedMessages]);

        return {
          ...params.createReadyState(limitedMessages),
          subscriptions: Array.from(params.activeSubscriptions.values())
        } as TState;
      });
    });

    console.log("Processed incoming message from accepted connection:", event.id);

    if (currentParams.onNewMessage) {
      currentParams.onNewMessage(message);
    }

    const metric = endTracking();
    if (metric.totalTime > 100) {
      console.warn(`Message processing took ${metric.totalTime.toFixed(2)}ms (target: <100ms)`);
    }
  } catch (error) {
    console.warn("Error processing incoming event:", error);
    endTracking();
  } finally {
    params.processingEvents.delete(event.id);
    globalProcessingEvents.delete(event.id);
  }
};
