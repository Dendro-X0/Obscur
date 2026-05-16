/**
 * Derives stable + NIP-17 rumor identifiers for DM delete propagation.
 * Keeps tombstones / suppress sets aligned across projection-first rows, optimistic UUID ids,
 * gift-wrap relay ids, and inlined rumor hashes (see conversation-message-materialization.ts).
 */

import type { Message } from "../types";
import { collectMessageIdentityAliases } from "./message-identity-alias-contract";

const fallbackDigestHex = (payload: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").repeat(8);
};

export const deriveNip17RumorId = async (params: Readonly<{
  senderPubkey: string;
  recipientPubkey: string;
  plaintext: string;
  createdAtUnixSeconds: number;
  replyToMessageId?: string | null;
}>): Promise<string> => {
  const tags: string[][] = [["p", params.recipientPubkey]];
  const replyToMessageId = params.replyToMessageId?.trim();
  if (replyToMessageId) {
    tags.push(["e", replyToMessageId, "", "reply"]);
  }
  const payload = JSON.stringify([
    0,
    params.senderPubkey,
    params.createdAtUnixSeconds,
    14,
    tags,
    params.plaintext,
  ]);
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return fallbackDigestHex(payload);
  }
};

const buildAttachmentMarkdown = (attachments: Message["attachments"]): string => {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return "";
  }
  return attachments
    .map((attachment) => {
      const fileName = typeof attachment?.fileName === "string" ? attachment.fileName.trim() : "";
      const url = typeof attachment?.url === "string" ? attachment.url.trim() : "";
      if (!fileName || !url) {
        return "";
      }
      return `[${fileName}](${url})`;
    })
    .filter((value: string): value is string => value.length > 0)
    .join(" ");
};

export const buildDeletePlaintextCandidates = (message: Message): ReadonlyArray<string> => {
  const candidates = new Set<string>();
  const content = typeof message.content === "string" ? message.content.trim() : "";
  if (content.length > 0) {
    candidates.add(content);
  }
  const attachmentMarkdown = buildAttachmentMarkdown(message.attachments);
  if (attachmentMarkdown.length > 0) {
    candidates.add(attachmentMarkdown);
    if (content.length > 0 && !content.includes(attachmentMarkdown)) {
      candidates.add(`${content}\n\n${attachmentMarkdown}`.trim());
      candidates.add(`${content} ${attachmentMarkdown}`.trim());
    }
  }
  return Array.from(candidates);
};

export const buildDeleteCreatedAtCandidates = (message: Message): ReadonlyArray<number> => {
  const candidates = new Set<number>();
  const pushDate = (value: Date | undefined) => {
    if (!(value instanceof Date)) {
      return;
    }
    const unixSeconds = Math.floor(value.getTime() / 1000);
    if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
      candidates.add(unixSeconds);
    }
  };
  pushDate(message.eventCreatedAt);
  pushDate(message.timestamp);
  return Array.from(candidates);
};

export const buildDeleteTargetIdsForDm = async (params: Readonly<{
  message: Message;
  senderPubkey: string | null;
  recipientPubkey: string | null;
}>): Promise<ReadonlyArray<string>> => {
  const deleteTargetIds = new Set<string>();
  const eventId = params.message.eventId?.trim();
  if (eventId && eventId.length > 0) {
    deleteTargetIds.add(eventId);
  }
  const relayPub = params.message.relayPublishedEventId?.trim();
  if (relayPub && relayPub.length > 0) {
    deleteTargetIds.add(relayPub);
  }
  const directMessageId = params.message.id.trim();
  if (directMessageId.length > 0) {
    deleteTargetIds.add(directMessageId);
  }

  collectMessageIdentityAliases(params.message).forEach((id) => {
    const trimmed = id.trim();
    if (trimmed.length > 0) {
      deleteTargetIds.add(trimmed);
    }
  });

  if (!params.senderPubkey || !params.recipientPubkey) {
    return Array.from(deleteTargetIds);
  }

  const plaintextCandidates = buildDeletePlaintextCandidates(params.message);
  const createdAtCandidates = buildDeleteCreatedAtCandidates(params.message);
  const replyToMessageId = params.message.replyTo?.messageId?.trim();
  const replyCandidates = replyToMessageId ? [replyToMessageId, null] : [null];

  for (const plaintext of plaintextCandidates) {
    if (plaintext.length === 0) {
      continue;
    }
    for (const createdAtUnixSeconds of createdAtCandidates) {
      for (const replyCandidate of replyCandidates) {
        const rumorId = await deriveNip17RumorId({
          senderPubkey: params.senderPubkey,
          recipientPubkey: params.recipientPubkey,
          plaintext,
          createdAtUnixSeconds,
          replyToMessageId: replyCandidate,
        });
        const normalizedRumorId = rumorId.trim();
        if (normalizedRumorId.length > 0) {
          deleteTargetIds.add(normalizedRumorId);
        }
      }
    }
  }

  return Array.from(deleteTargetIds);
};

export const buildLocalDeleteIdentityIdsForDm = async (params: Readonly<{
  message: Message;
  myPublicKeyHex: string | null;
  peerPublicKeyHex: string | null;
}>): Promise<ReadonlyArray<string>> => {
  const directIds = collectMessageIdentityAliases(params.message);
  if (!params.myPublicKeyHex || !params.peerPublicKeyHex) {
    return directIds;
  }

  const senderPubkey = params.message.isOutgoing
    ? params.myPublicKeyHex
    : params.peerPublicKeyHex;
  const recipientPubkey = params.message.isOutgoing
    ? params.peerPublicKeyHex
    : params.myPublicKeyHex;

  return buildDeleteTargetIdsForDm({
    message: params.message,
    senderPubkey,
    recipientPubkey,
  });
};
