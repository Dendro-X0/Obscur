import type { Dispatch, SetStateAction } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { DmEventBuildResult } from "./dm-event-builder";
import type { IMessageQueue, Message } from "../lib/message-queue";

export const prepareOutgoingDm = async (params: Readonly<{
  build: DmEventBuildResult;
  plaintext: string;
  createdAtUnixSeconds: number;
  myPublicKeyHex: PublicKeyHex;
  recipientPubkey: PublicKeyHex;
  replyTo?: string;

  maxMessagesInMemory: number;
  extractAttachmentsFromContent: (content: string) => Message["attachments"];

  messageQueue: IMessageQueue | null;
  setState: Dispatch<SetStateAction<any>>;
  createReadyState: (messages: ReadonlyArray<Message>) => any;
  messageMemoryManager: Readonly<{ addMessages: (conversationId: string, messages: ReadonlyArray<Message>) => void }>;
  getExistingMessagesForOptimisticInsert: (prev: any) => ReadonlyArray<Message>;

  pendingMessages: Map<string, Message>;
  relayRequestTimes: Map<string, number>;
}>): Promise<Readonly<{
  messageId: string;
  conversationId: string;
  initialMessage: Message;
}>> => {
  const messageId = params.build.signedEvent.id;
  const conversationId = [params.myPublicKeyHex, params.recipientPubkey].sort().join(":");

  const message: Message = {
    id: messageId,
    conversationId,
    content: params.plaintext,
    kind: "user",
    timestamp: new Date(params.createdAtUnixSeconds * 1000),
    isOutgoing: true,
    status: "sending",
    dmFormat: params.build.format,
    eventId: params.build.signedEvent.id,
    eventCreatedAt: new Date(params.createdAtUnixSeconds * 1000),
    senderPubkey: params.myPublicKeyHex,
    recipientPubkey: params.recipientPubkey,
    encryptedContent: params.build.encryptedContent,
    relayResults: [],
    retryCount: 0,
    replyTo: params.replyTo
      ? {
        messageId: params.replyTo,
        previewText: ""
      }
      : undefined,
    attachments: params.extractAttachmentsFromContent(params.plaintext)
  };

  if (params.messageQueue) {
    try {
      await params.messageQueue.persistMessage(message);
    } catch (storageError) {
      console.error("Failed to persist message:", storageError);
    }
  }

  params.setState((prev: any) => {
    const prevMessages = params.getExistingMessagesForOptimisticInsert(prev);
    const updatedMessages = [message, ...prevMessages].slice(0, params.maxMessagesInMemory);
    params.messageMemoryManager.addMessages(conversationId, updatedMessages);
    return params.createReadyState(updatedMessages);
  });

  params.pendingMessages.set(messageId, message);
  params.relayRequestTimes.set(messageId, Date.now());

  return { messageId, conversationId, initialMessage: message };
};
