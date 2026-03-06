import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { IMessageQueue, Message, OutgoingMessage } from "../lib/message-queue";
import { retryManager } from "../lib/retry-manager";
import { buildDmEvent, type DmEventBuildResult } from "./dm-event-builder";
import { countRelayFailures } from "./relay-utils";
import { logAppEvent } from "@/app/shared/log-app-event";
import { transitionMessageStatus } from "../state-machines/message-delivery-machine";

type MultiRelayPublishResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  overallError?: string;
}>;

type RelayPoolLike = Readonly<{
  sendToOpen: (payload: string) => void;
  publishToAll?: (payload: string) => Promise<MultiRelayPublishResult>;
}>;

type RelayLike = Readonly<{ url: string }>;

export const publishOutgoingDm = async (params: Readonly<{
  pool: RelayPoolLike;
  openRelays: ReadonlyArray<RelayLike>;
  messageQueue: IMessageQueue | null;

  initialMessage: Message;
  build: DmEventBuildResult;

  plaintext: string;
  recipientPubkey: PublicKeyHex;
  senderPubkey: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  createdAtUnixSeconds: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>): Promise<Readonly<{
  finalMessage: Message;
  publishResult: MultiRelayPublishResult;
  updatedSignedEvent?: NostrEvent;
}>> => {
  const publishOnce = async (signedEvent: NostrEvent): Promise<MultiRelayPublishResult> => {
    const eventPayload = JSON.stringify(["EVENT", signedEvent]);
    if (!params.pool.publishToAll) {
      params.pool.sendToOpen(eventPayload);
      return {
        success: true,
        successCount: params.openRelays.length,
        totalRelays: params.openRelays.length,
        results: params.openRelays.map(relay => ({ relayUrl: relay.url, success: true }))
      };
    }
    return params.pool.publishToAll(eventPayload);
  };

  let publishResult: MultiRelayPublishResult = await publishOnce(params.build.signedEvent);
  let finalMessage: Message = params.initialMessage;

  if (params.build.format === "nip17" && publishResult.successCount === 0) {
    logAppEvent({
      name: "messaging.dm.send.fallback_start",
      level: "warn",
      scope: { feature: "messaging", action: "send_dm" },
      context: { from: "nip17", to: "nip04", failures: countRelayFailures(publishResult.results) }
    });

    const fallbackBuild: DmEventBuildResult = await buildDmEvent({
      format: "nip04",
      plaintext: params.plaintext,
      recipientPubkey: params.recipientPubkey,
      senderPubkey: params.senderPubkey,
      senderPrivateKeyHex: params.senderPrivateKeyHex,
      createdAtUnixSeconds: params.createdAtUnixSeconds,
      tags: params.tags
    });

    publishResult = await publishOnce(fallbackBuild.signedEvent);

    finalMessage = {
      ...finalMessage,
      id: fallbackBuild.signedEvent.id,
      eventId: fallbackBuild.signedEvent.id,
      encryptedContent: fallbackBuild.encryptedContent,
      dmFormat: fallbackBuild.format,
      relayResults: []
    };

    if (params.messageQueue) {
      await params.messageQueue.persistMessage(finalMessage);
    }
    if (publishResult.successCount > 0) {
      const nextStatus = transitionMessageStatus(finalMessage.status, {
        type: "RELAY_ACCEPTED",
        successCount: publishResult.successCount,
        totalRelays: publishResult.totalRelays
      });
      finalMessage.status = nextStatus;
      if (params.messageQueue) {
        await params.messageQueue.updateMessageStatus(finalMessage.id, nextStatus);
      }
    } else {
      const nextStatus = transitionMessageStatus(finalMessage.status, {
        type: "RELAY_REJECTED",
        error: publishResult.overallError
      });
      finalMessage.status = nextStatus;
      if (params.messageQueue) {
        await params.messageQueue.updateMessageStatus(finalMessage.id, nextStatus);
        const outgoingMessage: OutgoingMessage = {
          id: finalMessage.id,
          conversationId: finalMessage.conversationId,
          content: params.plaintext,
          recipientPubkey: params.recipientPubkey,
          createdAt: new Date(),
          retryCount: 0,
          nextRetryAt: retryManager.calculateNextRetry(0),
          signedEvent: fallbackBuild.signedEvent
        };
        await params.messageQueue.queueOutgoingMessage(outgoingMessage);
      }
    }

    return { finalMessage, publishResult, updatedSignedEvent: fallbackBuild.signedEvent };
  }

  finalMessage = { ...finalMessage, relayResults: publishResult.results };

  if (publishResult.successCount > 0) {
    const nextStatus = transitionMessageStatus(finalMessage.status, {
      type: "RELAY_ACCEPTED",
      successCount: publishResult.successCount,
      totalRelays: publishResult.totalRelays
    });
    finalMessage.status = nextStatus;
    if (params.messageQueue) {
      await params.messageQueue.updateMessageStatus(finalMessage.id, nextStatus);
    }
  } else {
    const nextStatus = transitionMessageStatus(finalMessage.status, {
      type: "RELAY_REJECTED",
      error: publishResult.overallError
    });
    finalMessage.status = nextStatus;
    if (params.messageQueue) {
      await params.messageQueue.updateMessageStatus(finalMessage.id, nextStatus);
      const outgoingMessage: OutgoingMessage = {
        id: finalMessage.id,
        conversationId: finalMessage.conversationId,
        content: params.plaintext,
        recipientPubkey: params.recipientPubkey,
        createdAt: new Date(),
        retryCount: 0,
        nextRetryAt: retryManager.calculateNextRetry(0),
        signedEvent: finalMessage.eventId === params.build.signedEvent.id ? params.build.signedEvent : undefined
      };
      await params.messageQueue.queueOutgoingMessage(outgoingMessage);
    }
  }

  return { finalMessage, publishResult };
};

export const publishQueuedOutgoingMessage = async (params: Readonly<{
  pool: RelayPoolLike;
  messageQueue: IMessageQueue;
  message: OutgoingMessage;
}>): Promise<boolean> => {
  if (!params.message.signedEvent) {
    console.error("Queued message missing signed event");
    return false;
  }

  try {
    const eventPayload = JSON.stringify(["EVENT", params.message.signedEvent]);

    if (params.pool.publishToAll) {
      const result = await params.pool.publishToAll(eventPayload);
      if (result.success) {
        const nextStatus = transitionMessageStatus("sending", { type: "RELAY_ACCEPTED", successCount: result.successCount, totalRelays: result.totalRelays });
        await params.messageQueue.updateMessageStatus(params.message.id, nextStatus);
        return true;
      }

      const nextStatus = transitionMessageStatus("sending", { type: "RELAY_REJECTED", error: result.overallError });
      await params.messageQueue.updateMessageStatus(params.message.id, nextStatus);
      return false;
    }

    params.pool.sendToOpen(eventPayload);
    const nextStatus = transitionMessageStatus("sending", { type: "RELAY_ACCEPTED", successCount: 1, totalRelays: 1 });
    await params.messageQueue.updateMessageStatus(params.message.id, nextStatus);
    return true;
  } catch (error) {
    console.error("Failed to send queued message:", error);
    return false;
  }
};

export const publishOutgoingDmFireAndForget = (params: Readonly<{
  pool: RelayPoolLike;
  openRelays: ReadonlyArray<RelayLike>;
  signedEvent: NostrEvent;
}>): Readonly<{
  relayResults: MultiRelayPublishResult["results"];
}> => {
  const eventPayload = JSON.stringify(["EVENT", params.signedEvent]);
  params.pool.sendToOpen(eventPayload);

  return {
    relayResults: params.openRelays.map(relay => ({
      relayUrl: relay.url,
      success: true
    }))
  };
};

export const queueOutgoingDmForRetry = async (params: Readonly<{
  messageQueue: IMessageQueue;
  messageId: string;
  conversationId: string;
  plaintext: string;
  recipientPubkey: PublicKeyHex;
  signedEvent: NostrEvent;
}>): Promise<void> => {
  const outgoingMessage: OutgoingMessage = {
    id: params.messageId,
    conversationId: params.conversationId,
    content: params.plaintext,
    recipientPubkey: params.recipientPubkey,
    createdAt: new Date(),
    retryCount: 0,
    nextRetryAt: retryManager.calculateNextRetry(0),
    signedEvent: params.signedEvent
  };

  try {
    await params.messageQueue.queueOutgoingMessage(outgoingMessage);
    const nextStatus = transitionMessageStatus("rejected", { type: "RETRY_QUEUED", retryCount: 0, nextRetryAt: outgoingMessage.nextRetryAt });
    await params.messageQueue.updateMessageStatus(params.messageId, nextStatus);
  } catch (queueError) {
    console.error("Failed to queue message:", queueError);
  }
};
