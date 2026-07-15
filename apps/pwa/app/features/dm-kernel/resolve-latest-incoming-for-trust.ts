import type { Message } from "@/app/features/messaging/types";
import { resolveAttachmentContentDigestsFromUrls } from "./dm-kernel-trust-metadata-signals";

export type TrustIncomingSnapshot = Readonly<{
  content: string;
  timestampUnixMs: number;
  attachmentFileNames: ReadonlyArray<string>;
  attachmentContentDigests: ReadonlyArray<string>;
  senderPublicKeyHex: string | null;
}>;

export type TrustConnectionPreviewFallback = Readonly<{
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageIsOutgoing?: boolean;
}>;

/**
 * Latest inbound text for trust assessment — prefers hydrated thread messages,
 * then sidebar preview when the chat pane is empty (e.g. offline / not opened).
 */
export const resolveLatestIncomingForTrust = (
  messages: ReadonlyArray<Message>,
  connectionFallback?: TrustConnectionPreviewFallback,
): TrustIncomingSnapshot | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message.isOutgoing) {
      const attachmentUrls = (message.attachments ?? []).map((attachment) => attachment.url);
      return {
        content: message.content,
        timestampUnixMs: message.timestamp.getTime(),
        attachmentFileNames: (message.attachments ?? [])
          .map((attachment) => attachment.fileName)
          .filter((fileName) => fileName.length > 0),
        attachmentContentDigests: resolveAttachmentContentDigestsFromUrls(attachmentUrls),
        senderPublicKeyHex: message.senderPubkey ?? null,
      };
    }
  }

  if (
    connectionFallback?.lastMessage
    && !connectionFallback.lastMessageIsOutgoing
  ) {
    return {
      content: connectionFallback.lastMessage,
      timestampUnixMs: connectionFallback.lastMessageTime.getTime(),
      attachmentFileNames: [],
      attachmentContentDigests: [],
      senderPublicKeyHex: null,
    };
  }

  return null;
};
