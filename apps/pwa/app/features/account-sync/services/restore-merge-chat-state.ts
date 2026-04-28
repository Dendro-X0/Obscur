import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Attachment, PersistedChatState, PersistedGroupMessage, PersistedMessage } from "@/app/features/messaging/types";
import { normalizeMessageDeleteTombstoneEntries } from "@/app/features/messaging/services/message-delete-tombstone-store";
import { parseCommandMessage } from "@/app/features/messaging/utils/commands";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { collectMessageIdentityAliases } from "@/app/features/messaging/services/message-identity-alias-contract";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { EncryptedAccountBackupPayload, MessageDeleteTombstoneSnapshotEntry } from "../account-sync-contracts";
import { emitRestoreDeleteTargetUnresolved } from "./restore-merge-diagnostics";

export const uniqueStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  Array.from(new Set(values.filter((value) => value.length > 0)));

const PLACEHOLDER_GROUP_DISPLAY_NAME = "Private Group";
const HASHED_COMMUNITY_ID_PATTERN = /^v2_[0-9a-f]{64}$/i;

const hasMeaningfulGroupDisplayName = (value: string | undefined): boolean => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 && trimmed !== PLACEHOLDER_GROUP_DISPLAY_NAME;
};

export const pickPreferredGroupDisplayName = (
  newerName: string | undefined,
  olderName: string | undefined,
): string => {
  if (hasMeaningfulGroupDisplayName(newerName)) {
    return (newerName ?? "").trim();
  }
  if (hasMeaningfulGroupDisplayName(olderName)) {
    return (olderName ?? "").trim();
  }
  const fallback = (newerName ?? "").trim() || (olderName ?? "").trim();
  return fallback.length > 0 ? fallback : PLACEHOLDER_GROUP_DISPLAY_NAME;
};

export const isHashedCommunityId = (value: string | undefined): boolean => {
  const trimmed = value?.trim() ?? "";
  return HASHED_COMMUNITY_ID_PATTERN.test(trimmed);
};

export const toPreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 140)}...`;
};

export const resolveDeleteCommandTargetMessageId = (message: Readonly<{
  content?: unknown;
}>): string | null => {
  if (typeof message.content !== "string") {
    return null;
  }
  const parsedCommand = parseCommandMessage(message.content);
  if (!parsedCommand || parsedCommand.type !== "delete") {
    return null;
  }
  const targetMessageId = parsedCommand.targetMessageId.trim();
  return targetMessageId.length > 0 ? targetMessageId : null;
};

export const isCommandDmMessage = (message: Readonly<{
  kind?: unknown;
  content?: unknown;
}>): boolean => (
  message.kind === "command"
  || resolveDeleteCommandTargetMessageId(message) !== null
);

export const toPersistedMessageIdentityKeys = (message: Readonly<{
  id?: unknown;
  eventId?: unknown;
}>): ReadonlyArray<string> => collectMessageIdentityAliases(message);

export const toMessageDeleteTombstoneIdSet = (
  tombstones: ReadonlyArray<MessageDeleteTombstoneSnapshotEntry> | undefined
): ReadonlySet<string> => new Set(
  (tombstones ?? [])
    .map((entry) => entry.id.trim())
    .filter((entry) => entry.length > 0)
);

export const mergeMessageDeleteTombstones = (
  current: ReadonlyArray<MessageDeleteTombstoneSnapshotEntry> | undefined,
  incoming: ReadonlyArray<MessageDeleteTombstoneSnapshotEntry> | undefined,
): ReadonlyArray<MessageDeleteTombstoneSnapshotEntry> => normalizeMessageDeleteTombstoneEntries([
  ...(current ?? []),
  ...(incoming ?? []),
]);

const isPersistedMessageDeleted = (message: Readonly<{
  deletedAtMs?: unknown;
}>): boolean => (
  typeof message.deletedAtMs === "number"
  && Number.isFinite(message.deletedAtMs)
  && message.deletedAtMs > 0
);

const generateSyntheticMessageId = (message: PersistedMessage): string => {
  // Generate a deterministic synthetic ID for sparse legacy messages
  // that have content/attachments but lack proper id/eventId
  const contentHash = String(message.content ?? "").slice(0, 50);
  const timestamp = String(message.timestampMs ?? Date.now());
  const hasAttachments = (message.attachments?.length ?? 0) > 0;
  const attachmentHint = hasAttachments
    ? `|${message.attachments?.[0]?.kind ?? "file"}|${message.attachments?.[0]?.url?.slice(-20) ?? ""}`
    : "";
  return `synth:${timestamp}:${contentHash}${attachmentHint}`.replace(/\s+/g, "_");
};

const ensureMessageIdentityKeys = (message: PersistedMessage): ReadonlyArray<string> => {
  const existingKeys = toPersistedMessageIdentityKeys(message);
  if (existingKeys.length > 0) {
    return existingKeys;
  }
  // Generate synthetic identity for messages with content/attachments but no id
  if ((message.content?.trim().length ?? 0) > 0 || (message.attachments?.length ?? 0) > 0) {
    return [generateSyntheticMessageId(message)];
  }
  return [];
};

export const sanitizePersistedMessagesByDeleteContract = (
  messages: ReadonlyArray<PersistedMessage>,
  options?: Readonly<{
    durableDeleteIds?: ReadonlySet<string>;
  }>
): ReadonlyArray<PersistedMessage> => {
  if (messages.length === 0) {
    return messages;
  }

  // Entry diagnostics: Track video messages at function entry
  const entryVideos = messages.filter(m =>
    m.attachments?.some(a => a.kind === "video" || a.contentType?.startsWith("video/"))
  );
  if (entryVideos.length > 0) {
    console.log("[RestoreMerge] Video messages at entry:", {
      totalMessages: messages.length,
      videoMessages: entryVideos.length,
      videosWithId: entryVideos.filter(m => m.id || m.eventId).length,
      videosWithoutId: entryVideos.filter(m => !m.id && !m.eventId).length,
      videoAttachmentKinds: entryVideos.flatMap(m => m.attachments?.map(a => a.kind) ?? []),
    });
  }

  const normalizedMessages = messages.map((message) => normalizePersistedMessageAttachments(message));
  const deleteTargetMessageIds = new Set<string>(options?.durableDeleteIds ?? []);
  const commandMessageIds = new Set<string>();
  normalizedMessages.forEach((message) => {
    const identityKeys = ensureMessageIdentityKeys(message);
    const messageId = typeof message.id === "string" ? message.id.trim() : "";
    if (messageId.length > 0 && isCommandDmMessage(message)) {
      commandMessageIds.add(messageId);
    }
    const targetMessageId = resolveDeleteCommandTargetMessageId(message);
    if (targetMessageId) {
      deleteTargetMessageIds.add(targetMessageId);
    }
    if (isPersistedMessageDeleted(message)) {
      identityKeys.forEach((identityKey) => {
        deleteTargetMessageIds.add(identityKey);
      });
    }
  });
  if (deleteTargetMessageIds.size > 0) {
    const knownIdentityKeys = new Set<string>();
    normalizedMessages.forEach((message) => {
      ensureMessageIdentityKeys(message).forEach((identityKey) => {
        knownIdentityKeys.add(identityKey);
      });
    });
    const unresolvedTargets = Array.from(deleteTargetMessageIds).filter((targetMessageId) => !knownIdentityKeys.has(targetMessageId));
    if (unresolvedTargets.length > 0) {
      emitRestoreDeleteTargetUnresolved({
        messageCount: messages.length,
        commandMessageCount: commandMessageIds.size,
        deleteTargetCount: deleteTargetMessageIds.size,
        unresolvedDeleteTargetCount: unresolvedTargets.length,
        unresolvedDeleteTargetSample: unresolvedTargets.slice(0, 5).join(","),
      });
    }
  }
  // Media preservation diagnostics: track all media types before filtering
  const countMediaByKind = (messages: ReadonlyArray<PersistedMessage>): Readonly<{
    video: number; image: number; audio: number; file: number; voiceNote: number; total: number;
  }> => {
    let video = 0, image = 0, audio = 0, file = 0, voiceNote = 0, total = 0;
    messages.forEach(m => {
      m.attachments?.forEach(a => {
        total++;
        if (a.kind === "video") video++;
        else if (a.kind === "image") image++;
        else if (a.kind === "audio") audio++;
        else if (a.kind === "voice_note") voiceNote++;
        else if (a.kind === "file") file++;
      });
    });
    return { video, image, audio, file, voiceNote, total };
  };
  const mediaBefore = countMediaByKind(normalizedMessages);

  const filtered = normalizedMessages.filter((message) => {
    const identityKeys = ensureMessageIdentityKeys(message);
    if (identityKeys.length === 0) {
      // Log messages being dropped due to missing identity (potential media loss)
      if ((message.attachments?.length ?? 0) > 0) {
        console.warn("[RestoreMerge] Media-bearing message dropped (no identity keys):", {
          attachmentCount: message.attachments?.length,
          attachmentKinds: message.attachments?.map(a => a.kind),
          hasContent: (message.content?.trim().length ?? 0) > 0,
          timestampMs: message.timestampMs,
        });
      }
      return false;
    }
    if (isPersistedMessageDeleted(message)) {
      return false;
    }
    if (identityKeys.some((identityKey) => deleteTargetMessageIds.has(identityKey))) {
      return false;
    }
    return !isCommandDmMessage(message);
  }).map((message) => {
    // Preserve synthetic identity on messages that needed it
    const identityKeys = ensureMessageIdentityKeys(message);
    const hasSyntheticId = identityKeys.some(k => k.startsWith("synth:"));
    if (hasSyntheticId && !message.id) {
      return { ...message, id: identityKeys[0] };
    }
    return message;
  });

  const mediaAfter = countMediaByKind(filtered);

  // Emit media preservation diagnostics
  if (mediaBefore.total > 0 && mediaAfter.total < mediaBefore.total) {
    console.warn("[RestoreMerge] Media attachments filtered during restore:", {
      before: mediaBefore,
      after: mediaAfter,
      removed: {
        video: mediaBefore.video - mediaAfter.video,
        image: mediaBefore.image - mediaAfter.image,
        audio: mediaBefore.audio - mediaAfter.audio,
        file: mediaBefore.file - mediaAfter.file,
        voiceNote: mediaBefore.voiceNote - mediaAfter.voiceNote,
        total: mediaBefore.total - mediaAfter.total,
      },
      messageCountBefore: normalizedMessages.length,
      messageCountAfter: filtered.length,
    });
  } else if (mediaBefore.total > 0) {
    console.log("[RestoreMerge] Media preserved:", {
      video: mediaAfter.video,
      image: mediaAfter.image,
      audio: mediaAfter.audio,
      file: mediaAfter.file,
      voiceNote: mediaAfter.voiceNote,
      total: mediaAfter.total,
    });
  }

  if (filtered.length <= 1) {
    return filtered;
  }
  return filtered.slice().sort((left, right) => Number(left.timestampMs ?? 0) - Number(right.timestampMs ?? 0));
};

export const sanitizePersistedChatStateMessagesByDeleteContract = (
  chatState: EncryptedAccountBackupPayload["chatState"],
  options?: Readonly<{
    durableDeleteIds?: ReadonlySet<string>;
  }>
): EncryptedAccountBackupPayload["chatState"] => {
  if (!chatState) {
    return chatState;
  }

  const sanitizedMessagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {};
  Object.entries(chatState.messagesByConversationId ?? {}).forEach(([conversationId, messages]) => {
    const sanitizedMessages = sanitizePersistedMessagesByDeleteContract(messages ?? [], options);
    if (sanitizedMessages.length > 0) {
      sanitizedMessagesByConversationId[conversationId] = sanitizedMessages;
    }
  });

  const latestMessageByConversationId = new Map<string, PersistedMessage>();
  Object.entries(sanitizedMessagesByConversationId).forEach(([conversationId, messages]) => {
    const latest = messages[messages.length - 1];
    if (latest) {
      latestMessageByConversationId.set(conversationId, latest);
    }
  });

  const sanitizedCreatedConnections = chatState.createdConnections.map((connection) => {
    const latestMessage = latestMessageByConversationId.get(connection.id);
    const parsedCommandPreview = parseCommandMessage(connection.lastMessage ?? "");
    if (!latestMessage) {
      if (!parsedCommandPreview) {
        return connection;
      }
      return {
        ...connection,
        lastMessage: "",
        lastMessageTimeMs: 0,
      };
    }
    if (!parsedCommandPreview && latestMessage.timestampMs < connection.lastMessageTimeMs) {
      return connection;
    }
    return {
      ...connection,
      lastMessage: toPreview(latestMessage.content ?? ""),
      lastMessageTimeMs: latestMessage.timestampMs,
    };
  });

  return {
    ...chatState,
    createdConnections: sanitizedCreatedConnections,
    messagesByConversationId: sanitizedMessagesByConversationId,
  };
};

export const getPersistedMessageCount = (value: EncryptedAccountBackupPayload["chatState"]): number => {
  if (!value) {
    return 0;
  }
  return Object.values(value.messagesByConversationId).reduce((sum, messages) => sum + messages.length, 0);
};

export const getPersistedGroupMessageCount = (value: EncryptedAccountBackupPayload["chatState"]): number => {
  if (!value) {
    return 0;
  }
  return Object.values(value.groupMessages ?? {}).reduce((sum, messages) => sum + messages.length, 0);
};

export const getPersistedOutgoingMessageCount = (
  value: EncryptedAccountBackupPayload["chatState"],
  publicKeyHex: PublicKeyHex
): number => {
  if (!value) {
    return 0;
  }
  return Object.values(value.messagesByConversationId).reduce((sum, messages) => {
    const outgoingCount = messages.filter((message) => (
      message.isOutgoing === true
      || normalizePublicKeyHex(message.pubkey) === publicKeyHex
    )).length;
    return sum + outgoingCount;
  }, 0);
};

export const hasReplayableChatHistory = (value: EncryptedAccountBackupPayload["chatState"]): boolean => (
  getPersistedMessageCount(value) > 0 || getPersistedGroupMessageCount(value) > 0
);

export const pickNewestBy = <T extends Record<string, unknown>>(
  values: ReadonlyArray<T>,
  getKey: (value: T) => string,
  getUpdatedAt: (value: T) => number
): ReadonlyArray<T> => {
  const map = new Map<string, T>();
  for (const value of values) {
    const key = getKey(value);
    const current = map.get(key);
    if (!current || getUpdatedAt(value) >= getUpdatedAt(current)) {
      map.set(key, value);
    }
  }
  return Array.from(map.values());
};

const toAttachmentKind = (value: unknown): Attachment["kind"] | null => {
  if (value === "image" || value === "video" || value === "audio" || value === "voice_note" || value === "file") {
    return value;
  }
  return null;
};

const extractAttachmentFileNameFromUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const withoutQuery = trimmed.split("#")[0]?.split("?")[0] ?? trimmed;
  const segment = withoutQuery.split("/").pop()?.trim() ?? "";
  if (!segment) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(segment).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return segment;
  }
};

const inferAttachmentKindFromCandidate = (params: Readonly<{
  kindHint: Attachment["kind"] | null;
  contentType: string;
  fileName: string;
  url: string;
}>): Attachment["kind"] => {
  if (params.kindHint) {
    return params.kindHint;
  }
  const probe = `${params.contentType} ${params.fileName} ${params.url}`.toLowerCase();
  if (probe.includes("voice-note") || probe.includes("voice_note")) {
    return "voice_note";
  }
  if (probe.includes("image/") || /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(probe)) {
    return "image";
  }
  if (probe.includes("video/") || /\.(mp4|mov|m4v|mkv|webm|avi)$/i.test(probe)) {
    return "video";
  }
  if (probe.includes("audio/") || /\.(mp3|wav|m4a|ogg|opus|aac|flac|weba)$/i.test(probe)) {
    return "audio";
  }
  return "file";
};

const inferAttachmentContentTypeFromCandidate = (params: Readonly<{
  explicit: string;
  kind: Attachment["kind"];
  fileName: string;
  url: string;
}>): string => {
  if (params.explicit.length > 0) {
    return params.explicit;
  }
  const probe = `${params.fileName} ${params.url}`.toLowerCase();
  if (params.kind === "voice_note") return "audio/webm";
  if (params.kind === "image") {
    if (probe.includes(".png")) return "image/png";
    if (probe.includes(".gif")) return "image/gif";
    if (probe.includes(".webp")) return "image/webp";
    return "image/jpeg";
  }
  if (params.kind === "video") {
    if (probe.includes(".webm")) return "video/webm";
    if (probe.includes(".mov")) return "video/quicktime";
    return "video/mp4";
  }
  if (params.kind === "audio") {
    if (probe.includes(".wav")) return "audio/wav";
    if (probe.includes(".ogg")) return "audio/ogg";
    if (probe.includes(".m4a")) return "audio/mp4";
    return "audio/mpeg";
  }
  if (probe.includes(".pdf")) return "application/pdf";
  return "application/octet-stream";
};

export const parseAttachmentCandidate = (value: unknown): Attachment | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<Attachment>;
  const kindHint = toAttachmentKind(candidate.kind);
  const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
  const contentType = typeof candidate.contentType === "string" ? candidate.contentType.trim() : "";
  const fileName = typeof candidate.fileName === "string" ? candidate.fileName.trim() : "";
  if (!url) {
    return null;
  }
  const normalizedFileName = fileName || extractAttachmentFileNameFromUrl(url) || "attachment";
  const kind = inferAttachmentKindFromCandidate({
    kindHint,
    contentType,
    fileName: normalizedFileName,
    url,
  });
  const result: Attachment = {
    kind,
    url,
    contentType: inferAttachmentContentTypeFromCandidate({
      explicit: contentType,
      kind,
      fileName: normalizedFileName,
      url,
    }),
    fileName: normalizedFileName,
  };
  // Diagnostic: Log video attachments being parsed during restore
  if (kind === "video" || contentType?.startsWith("video/")) {
    console.log("[RestoreMerge] Video attachment parsed:", {
      originalUrl: candidate.url?.substring(0, 50),
      parsedUrl: url.substring(0, 50),
      kind,
      contentType,
      fileName: normalizedFileName,
      hasResult: !!result,
    });
  }
  return result;
};

export const dedupeAttachments = (attachments: ReadonlyArray<Attachment>): ReadonlyArray<Attachment> => {
  if (attachments.length <= 1) {
    return attachments;
  }
  const byUrl = new Map<string, Attachment>();
  attachments.forEach((attachment) => {
    const url = attachment.url.trim();
    if (!url || byUrl.has(url)) {
      return;
    }
    byUrl.set(url, {
      ...attachment,
      url,
    });
  });
  return Array.from(byUrl.values());
};

export const normalizePersistedMessageAttachments = (message: PersistedMessage): PersistedMessage => {
  const candidateRecord = message as unknown as Readonly<Record<string, unknown>>;
  const fromArray = Array.isArray(message.attachments)
    ? message.attachments
      .map((attachment) => parseAttachmentCandidate(attachment))
      .filter((attachment): attachment is Attachment => attachment !== null)
    : [];
  const fromLegacySingle = parseAttachmentCandidate(candidateRecord.attachment);
  const normalizedAttachments = dedupeAttachments([
    ...fromArray,
    ...(fromLegacySingle ? [fromLegacySingle] : []),
  ]);
  if (normalizedAttachments.length === 0) {
    const { attachments: _attachments, ...rest } = message as PersistedMessage & Readonly<{ attachments?: ReadonlyArray<Attachment> }>;
    return rest;
  }
  return {
    ...message,
    attachments: normalizedAttachments,
  };
};

export const normalizeMessageStatus = (value: unknown): PersistedMessage["status"] => {
  switch (value) {
    case "delivered":
    case "sending":
    case "accepted":
    case "rejected":
    case "queued":
    case "failed":
      return value;
    default:
      return "delivered";
  }
};

const mergePersistedAttachments = (
  current: ReadonlyArray<Attachment> | undefined,
  incoming: ReadonlyArray<Attachment> | undefined,
): ReadonlyArray<Attachment> | undefined => {
  const currentList = current ?? [];
  const incomingList = incoming ?? [];
  if (currentList.length === 0 && incomingList.length === 0) {
    return undefined;
  }
  const byUrl = new Map<string, Attachment>();
  [...currentList, ...incomingList].forEach((attachment) => {
    const url = attachment.url?.trim();
    if (!url) {
      return;
    }
    byUrl.set(url, {
      ...attachment,
      url,
    });
  });
  return Array.from(byUrl.values());
};

const mergePersistedMessageEntry = (
  left: PersistedMessage,
  right: PersistedMessage,
): PersistedMessage => {
  const rightIsNewer = Number(right.timestampMs ?? 0) >= Number(left.timestampMs ?? 0);
  const primary = rightIsNewer ? right : left;
  const secondary = rightIsNewer ? left : right;
  const mergedAttachments = mergePersistedAttachments(secondary.attachments, primary.attachments);
  return {
    ...secondary,
    ...primary,
    ...(mergedAttachments && mergedAttachments.length > 0 ? { attachments: mergedAttachments } : {}),
  };
};

export const mergePersistedMessages = (
  current: ReadonlyArray<PersistedMessage>,
  incoming: ReadonlyArray<PersistedMessage>,
): ReadonlyArray<PersistedMessage> => {
  const byCanonicalIdentity = new Map<string, PersistedMessage>();
  const canonicalIdentityByAlias = new Map<string, string>();
  for (const message of [...current, ...incoming]) {
    const identityKeys = toPersistedMessageIdentityKeys(message);
    if (identityKeys.length === 0) {
      continue;
    }
    const existingCanonicalIdentity = identityKeys.reduce<string | null>((resolved, identityKey) => {
      if (resolved) {
        return resolved;
      }
      return canonicalIdentityByAlias.get(identityKey) ?? null;
    }, null);
    const canonicalIdentity = existingCanonicalIdentity ?? identityKeys[0];
    const existing = byCanonicalIdentity.get(canonicalIdentity);
    const merged = existing
      ? mergePersistedMessageEntry(existing, message)
      : message;

    const mergedIdentityKeys = toPersistedMessageIdentityKeys(merged);
    mergedIdentityKeys.forEach((identityKey) => {
      canonicalIdentityByAlias.set(identityKey, canonicalIdentity);
    });
    identityKeys.forEach((identityKey) => {
      canonicalIdentityByAlias.set(identityKey, canonicalIdentity);
    });

    if (!existing) {
      byCanonicalIdentity.set(canonicalIdentity, merged);
      continue;
    }
    byCanonicalIdentity.set(canonicalIdentity, merged);
  }
  return Array.from(byCanonicalIdentity.values()).sort((a, b) => Number(a.timestampMs ?? 0) - Number(b.timestampMs ?? 0));
};

export const mergePersistedGroupMessages = (
  current: ReadonlyArray<PersistedGroupMessage>,
  incoming: ReadonlyArray<PersistedGroupMessage>,
): ReadonlyArray<PersistedGroupMessage> => {
  const byId = new Map<string, PersistedGroupMessage>();
  for (const message of [...current, ...incoming]) {
    const key = message.id;
    if (!key) {
      continue;
    }
    const existing = byId.get(key);
    if (!existing || Number(message.created_at ?? 0) >= Number(existing.created_at ?? 0)) {
      byId.set(key, message);
    }
  }
  return Array.from(byId.values()).sort((a, b) => Number(a.created_at ?? 0) - Number(b.created_at ?? 0));
};

const mergeMessageMaps = (
  current: PersistedChatState["messagesByConversationId"],
  incoming: PersistedChatState["messagesByConversationId"],
): PersistedChatState["messagesByConversationId"] => {
  const merged: Record<string, ReadonlyArray<PersistedMessage>> = {};
  const keys = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  keys.forEach((conversationId) => {
    const currentMessages = current[conversationId] ?? [];
    const incomingMessages = incoming[conversationId] ?? [];
    merged[conversationId] = mergePersistedMessages(currentMessages, incomingMessages);
  });
  return merged;
};

const mergeGroupMessageMaps = (
  current: PersistedChatState["groupMessages"] | undefined,
  incoming: PersistedChatState["groupMessages"] | undefined,
): PersistedChatState["groupMessages"] => {
  const currentMap = current ?? {};
  const incomingMap = incoming ?? {};
  const merged: Record<string, ReadonlyArray<PersistedGroupMessage>> = {};
  const keys = new Set([...Object.keys(currentMap), ...Object.keys(incomingMap)]);
  keys.forEach((conversationId) => {
    const currentMessages = currentMap[conversationId] ?? [];
    const incomingMessages = incomingMap[conversationId] ?? [];
    merged[conversationId] = mergePersistedGroupMessages(currentMessages, incomingMessages);
  });
  return merged;
};

const toPersistedGroupMergeKey = (group: PersistedChatState["createdGroups"][number]): string => {
  const groupId = String(group.groupId ?? "").trim();
  const relayUrl = String(group.relayUrl ?? "").trim();
  if (groupId.length > 0 && relayUrl.length > 0) {
    return `${groupId}@@${relayUrl}`;
  }
  return String(group.id ?? "").trim();
};

const mergePersistedGroupConversations = (
  current: PersistedChatState["createdGroups"],
  incoming: PersistedChatState["createdGroups"],
): PersistedChatState["createdGroups"] => {
  const byKey = new Map<string, PersistedChatState["createdGroups"][number]>();

  const mergeEntry = (
    left: PersistedChatState["createdGroups"][number],
    right: PersistedChatState["createdGroups"][number],
  ): PersistedChatState["createdGroups"][number] => {
    const rightIsNewer = Number(right.lastMessageTimeMs ?? 0) >= Number(left.lastMessageTimeMs ?? 0);
    const newer = rightIsNewer ? right : left;
    const older = rightIsNewer ? left : right;

    const mergedGroupId = String(newer.groupId ?? older.groupId ?? "").trim();
    const mergedRelayUrl = String(newer.relayUrl ?? older.relayUrl ?? "").trim();
    const mergedCommunityIdCandidate = (
      isHashedCommunityId(newer.communityId)
        ? newer.communityId
        : isHashedCommunityId(older.communityId)
          ? older.communityId
          : (newer.communityId ?? "").trim() || (older.communityId ?? "").trim() || undefined
    );
    const mergedGenesisEventId = newer.genesisEventId ?? older.genesisEventId;
    const mergedCreatorPubkey = newer.creatorPubkey ?? older.creatorPubkey;

    const mergedMemberPubkeys = uniqueStrings([
      ...(left.memberPubkeys ?? []),
      ...(right.memberPubkeys ?? []),
      ...(left.creatorPubkey ? [left.creatorPubkey] : []),
      ...(right.creatorPubkey ? [right.creatorPubkey] : []),
    ]);
    const mergedAdminPubkeys = uniqueStrings([
      ...(left.adminPubkeys ?? []),
      ...(right.adminPubkeys ?? []),
    ]);
    const mergedConversationId = (mergedGroupId.length > 0 && mergedRelayUrl.length > 0)
      ? toGroupConversationId({
        groupId: mergedGroupId,
        relayUrl: mergedRelayUrl,
        communityId: mergedCommunityIdCandidate,
        genesisEventId: mergedGenesisEventId,
        creatorPubkey: mergedCreatorPubkey,
      })
      : (newer.id || older.id);

    const newerAvatar = newer.avatar?.trim();
    const olderAvatar = older.avatar?.trim();
    const newerAbout = newer.about?.trim();
    const olderAbout = older.about?.trim();

    return {
      ...older,
      ...newer,
      id: mergedConversationId,
      groupId: mergedGroupId,
      relayUrl: mergedRelayUrl,
      communityId: mergedCommunityIdCandidate,
      genesisEventId: mergedGenesisEventId,
      creatorPubkey: mergedCreatorPubkey,
      displayName: pickPreferredGroupDisplayName(newer.displayName, older.displayName),
      memberPubkeys: mergedMemberPubkeys,
      adminPubkeys: mergedAdminPubkeys,
      memberCount: Math.max(
        left.memberCount ?? 0,
        right.memberCount ?? 0,
        mergedMemberPubkeys.length,
      ),
      lastMessage: (newer.lastMessage ?? "").trim().length > 0
        ? newer.lastMessage
        : older.lastMessage,
      avatar: newerAvatar && newerAvatar.length > 0
        ? newerAvatar
        : olderAvatar && olderAvatar.length > 0
          ? olderAvatar
          : undefined,
      about: newerAbout && newerAbout.length > 0
        ? newerAbout
        : olderAbout && olderAbout.length > 0
          ? olderAbout
          : undefined,
    };
  };

  for (const group of [...current, ...incoming]) {
    const key = toPersistedGroupMergeKey(group);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, group);
      continue;
    }
    byKey.set(key, mergeEntry(existing, group));
  }

  return Array.from(byKey.values());
};

export const mergeChatState = (
  current: EncryptedAccountBackupPayload["chatState"],
  incoming: EncryptedAccountBackupPayload["chatState"],
  options?: Readonly<{
    durableDeleteIds?: ReadonlySet<string>;
  }>
): EncryptedAccountBackupPayload["chatState"] => {
  if (!current) {
    return sanitizePersistedChatStateMessagesByDeleteContract(incoming, options);
  }
  if (!incoming) {
    return sanitizePersistedChatStateMessagesByDeleteContract(current, options);
  }
  return sanitizePersistedChatStateMessagesByDeleteContract({
    ...incoming,
    createdConnections: pickNewestBy(
      [...current.createdConnections, ...incoming.createdConnections],
      (value) => String(value.id ?? ""),
      (value) => Number(value.lastMessageTimeMs ?? 0)
    ),
    createdGroups: mergePersistedGroupConversations(
      current.createdGroups,
      incoming.createdGroups,
    ),
    connectionRequests: pickNewestBy(
      [...(current.connectionRequests ?? []), ...(incoming.connectionRequests ?? [])],
      (value) => String(value.id ?? ""),
      (value) => Number(value.timestampMs ?? 0)
    ),
    pinnedChatIds: uniqueStrings([...(current.pinnedChatIds ?? []), ...(incoming.pinnedChatIds ?? [])]),
    hiddenChatIds: uniqueStrings([...(current.hiddenChatIds ?? []), ...(incoming.hiddenChatIds ?? [])]),
    unreadByConversationId: {
      ...current.unreadByConversationId,
      ...incoming.unreadByConversationId,
    },
    connectionOverridesByConnectionId: {
      ...current.connectionOverridesByConnectionId,
      ...incoming.connectionOverridesByConnectionId,
    },
    messagesByConversationId: mergeMessageMaps(
      current.messagesByConversationId,
      incoming.messagesByConversationId,
    ),
    groupMessages: mergeGroupMessageMaps(current.groupMessages, incoming.groupMessages),
  }, options);
};
