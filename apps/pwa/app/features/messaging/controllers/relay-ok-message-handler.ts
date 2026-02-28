import type { Dispatch, SetStateAction } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { IMessageQueue, Message } from "../lib/message-queue";
import type { MessageStatus } from "../lib/message-queue";
import { retryManager } from "../lib/retry-manager";
import { parseRelayOkMessage } from "./relay-utils";

export const handleRelayOkMessage = (params: Readonly<{
  evt: Readonly<{ url: string; message: string }>;
  openRelayCount: number;
  pendingMessages: Map<string, Message>;
  relayRequestTimes: Map<string, number>;
  messageQueue: IMessageQueue | null;
  setState: Dispatch<SetStateAction<any>>;
  createReadyState: (messages: Message[]) => any;
  isValidStatusTransition: (from: MessageStatus, to: MessageStatus) => boolean;
}>): boolean => {
  const ok = parseRelayOkMessage(params.evt.message);
  if (!ok) return false;

  const pendingMessage = params.pendingMessages.get(ok.eventId);
  if (!pendingMessage) return true;

  const requestTime = params.relayRequestTimes.get(ok.eventId);
  const latency = requestTime ? Date.now() - requestTime : undefined;

  const relayResult = {
    relayUrl: params.evt.url,
    success: ok.ok,
    error: ok.ok ? undefined : ok.message,
    latency
  };

  const updatedMessage: Message = {
    ...pendingMessage,
    relayResults: [...(pendingMessage.relayResults || []), relayResult]
  };

  const hasSuccess = updatedMessage.relayResults?.some(r => r.success) || false;
  const hasFailure = updatedMessage.relayResults?.some(r => !r.success) || false;
  const allResponded = updatedMessage.relayResults?.length === params.openRelayCount;

  let newStatus = updatedMessage.status;

  if (hasSuccess) {
    newStatus = "accepted";
    retryManager.recordRelaySuccess(params.evt.url);
  } else if (hasFailure && allResponded) {
    newStatus = "rejected";
    retryManager.recordRelayFailure(params.evt.url, ok.message);

    if (params.messageQueue && updatedMessage.retryCount !== undefined) {
      const retryResult = retryManager.shouldRetry({
        id: updatedMessage.id,
        conversationId: updatedMessage.conversationId,
        content: updatedMessage.content,
        recipientPubkey: updatedMessage.recipientPubkey as PublicKeyHex,
        createdAt: updatedMessage.timestamp,
        retryCount: updatedMessage.retryCount,
        nextRetryAt: new Date()
      });

      if (retryResult.shouldRetry && retryResult.nextRetryAt) {
        newStatus = "queued";
        updatedMessage.retryCount = (updatedMessage.retryCount || 0) + 1;

        void params.messageQueue.queueOutgoingMessage({
          id: updatedMessage.id,
          conversationId: updatedMessage.conversationId,
          content: updatedMessage.content,
          recipientPubkey: updatedMessage.recipientPubkey as PublicKeyHex,
          createdAt: updatedMessage.timestamp,
          retryCount: updatedMessage.retryCount,
          nextRetryAt: retryResult.nextRetryAt
        });
      } else {
        newStatus = "failed";
      }
    }
  }

  if (newStatus !== updatedMessage.status) {
    if (params.isValidStatusTransition(updatedMessage.status, newStatus)) {
      updatedMessage.status = newStatus;
    } else {
      console.warn(`Invalid status transition: ${updatedMessage.status} -> ${newStatus}`);
    }
  }

  params.pendingMessages.set(ok.eventId, updatedMessage);

  if (params.messageQueue) {
    void params.messageQueue.updateMessageStatus(ok.eventId, updatedMessage.status);
  }

  params.setState((prev: any) => {
    const updatedMessages = prev.messages.map((m: Message) =>
      m.eventId === ok.eventId ? updatedMessage : m
    );
    return params.createReadyState(updatedMessages);
  });

  return true;
};
