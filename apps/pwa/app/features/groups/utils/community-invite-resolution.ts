import type { Message } from "@/app/features/messaging/types";
import type { InviteResponseStatus } from "@/app/features/messaging/components/message-list-render-meta";
import { collectCommunityInviteMessageIdentityAliases } from "./community-invite-dm-message";
import { normalizeCommunityInvitePayload, type InvitePayload } from "./community-invite-payload";
import {
  buildCommunityDmInviteStatusByInviteId,
  parseInvitePayloadFromMessageContent,
  parseInviteResponsePayloadFromMessageContent,
} from "../services/community-dm-invite-pipeline";
import type { CommunityDmInviteId } from "../services/community-dm-invite-contract";
import { listCommunityDmInviteLedgerForConversation } from "../services/community-dm-invite-ledger";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const TERMINAL_INVITE_RESPONSE_STATUSES = new Set<InviteResponseStatus>([
  "accepted",
  "declined",
  "canceled",
]);

const isTerminalInviteResponseStatus = (status: unknown): status is InviteResponseStatus => (
  typeof status === "string" && TERMINAL_INVITE_RESPONSE_STATUSES.has(status as InviteResponseStatus)
);

const parseJsonPayload = (content: string): Record<string, unknown> | null => {
  const trimmed = content.trim().replace(/^\uFEFF/, "");
  if (!trimmed) {
    return null;
  }
  let candidate: unknown = trimmed;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof candidate !== "string") {
      break;
    }
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  return candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null;
};

const readInviteGroupId = (record: Record<string, unknown> | null): string | null => {
  if (!record || record.type !== "community-invite") {
    return null;
  }
  const groupId = typeof record.groupId === "string" ? record.groupId.trim() : "";
  return groupId.length > 0 ? groupId : null;
};

const readResponseFields = (record: Record<string, unknown> | null): Readonly<{
  groupId: string | null;
  status: InviteResponseStatus | null;
}> => {
  if (!record || record.type !== "community-invite-response") {
    return { groupId: null, status: null };
  }
  const groupId = typeof record.groupId === "string" ? record.groupId.trim() : "";
  const status = isTerminalInviteResponseStatus(record.status) ? record.status : null;
  return {
    groupId: groupId.length > 0 ? groupId : null,
    status,
  };
};

const toMessageUnixMs = (message: Message): number => (
  message.eventCreatedAt?.getTime() ?? message.timestamp.getTime()
);

type InviteIndexEntry = Readonly<{
  messageId: string;
  inviteId: CommunityDmInviteId | null;
  groupId: string;
  isOutgoing: boolean;
  timestampMs: number;
}>;

const registerInviteIdentityAliases = (
  inviteIdentityToMessageId: Map<string, string>,
  message: Message,
  inviteMessageId: string,
): void => {
  collectCommunityInviteMessageIdentityAliases(message).forEach((alias) => {
    inviteIdentityToMessageId.set(alias, inviteMessageId);
  });
};

const assignInviteMessageStatus = (
  invites: ReadonlyArray<InviteIndexEntry>,
  statusByInviteMessageId: Map<string, InviteResponseStatus>,
  inviteMessageId: string,
  status: InviteResponseStatus,
  responseAtMs: number,
): void => {
  if (statusByInviteMessageId.has(inviteMessageId)) {
    return;
  }
  const existingInvite = invites.find((entry) => entry.messageId === inviteMessageId);
  if (!existingInvite || responseAtMs >= existingInvite.timestampMs) {
    statusByInviteMessageId.set(inviteMessageId, status);
  }
};

const buildInviteIndex = (
  messages: ReadonlyArray<Message>,
): Readonly<{
  inviteIdentityToMessageId: Map<string, string>;
  invites: InviteIndexEntry[];
}> => {
  const inviteIdentityToMessageId = new Map<string, string>();
  const invites: InviteIndexEntry[] = [];

  messages.forEach((message) => {
    const parsed = parseJsonPayload(message.content);
    const groupId = readInviteGroupId(parsed);
    if (!groupId) {
      return;
    }
    const wireInvite = parseInvitePayloadFromMessageContent(message.content);
    invites.push({
      messageId: message.id,
      inviteId: wireInvite?.inviteId ?? null,
      groupId,
      isOutgoing: message.isOutgoing,
      timestampMs: toMessageUnixMs(message),
    });
    registerInviteIdentityAliases(inviteIdentityToMessageId, message, message.id);
  });

  return { inviteIdentityToMessageId, invites };
};

/** Link terminal responses to invite rows via replyTo aliases (wire + legacy inviteId). */
const applyReplyToInviteResponseLinking = (
  messages: ReadonlyArray<Message>,
  statusByInviteMessageId: Map<string, InviteResponseStatus>,
  replyToLinkedInviteMessageIds?: Set<string>,
): void => {
  const { inviteIdentityToMessageId, invites } = buildInviteIndex(messages);

  messages.forEach((message) => {
    const parsed = parseJsonPayload(message.content);
    const { status } = readResponseFields(parsed);
    if (!status) {
      return;
    }
    const replyTargetId = message.replyTo?.messageId?.trim();
    if (!replyTargetId) {
      return;
    }
    const inviteMessageId = inviteIdentityToMessageId.get(replyTargetId);
    if (!inviteMessageId) {
      return;
    }
    assignInviteMessageStatus(
      invites,
      statusByInviteMessageId,
      inviteMessageId,
      status,
      toMessageUnixMs(message),
    );
    replyToLinkedInviteMessageIds?.add(inviteMessageId);
  });
};

const pickLatestInviteEntryBeforeResponse = (
  candidates: ReadonlyArray<InviteIndexEntry>,
  responseAtMs: number,
): InviteIndexEntry | undefined => {
  let latest: InviteIndexEntry | undefined;
  candidates.forEach((entry) => {
    if (responseAtMs < entry.timestampMs) {
      return;
    }
    if (!latest || entry.timestampMs >= latest.timestampMs) {
      latest = entry;
    }
  });
  return latest;
};

const replyToResolvesToInvite = (
  message: Message,
  inviteIdentityToMessageId: ReadonlyMap<string, string>,
): boolean => {
  const replyTargetId = message.replyTo?.messageId?.trim();
  return Boolean(replyTargetId && inviteIdentityToMessageId.has(replyTargetId));
};

const resolveStatusForInviteId = (
  invite: Readonly<{ inviteId: CommunityDmInviteId; groupId: string }>,
  statusByInviteId: ReadonlyMap<CommunityDmInviteId, InviteResponseStatus>,
): InviteResponseStatus | undefined => {
  const direct = statusByInviteId.get(invite.inviteId);
  if (direct && direct !== "pending") {
    return direct;
  }
  if (invite.inviteId.startsWith("legacy:")) {
    const legacyGroupId = `legacy:${invite.groupId}` as CommunityDmInviteId;
    const legacyGroup = statusByInviteId.get(legacyGroupId);
    if (legacyGroup && legacyGroup !== "pending") {
      return legacyGroup;
    }
  }
  return undefined;
};

const propagateLegacyResponseStatusesToWireInviteIds = (
  messages: ReadonlyArray<Message>,
  statusByInviteId: Map<CommunityDmInviteId, InviteResponseStatus>,
): void => {
  const { inviteIdentityToMessageId, invites } = buildInviteIndex(messages);

  messages.forEach((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (!response) {
      return;
    }
    if (!response.inviteId.startsWith("legacy:")) {
      return;
    }
    if (replyToResolvesToInvite(message, inviteIdentityToMessageId)) {
      return;
    }
    const responseAtMs = toMessageUnixMs(message);
    const responseSender = message.senderPubkey?.trim();
    const candidates = invites.filter((entry) => (
      entry.groupId === response.groupId
      && responseAtMs >= entry.timestampMs
    ));
    const inviterSentCandidates = responseSender
      ? candidates.filter((entry) => {
        const inviteMessage = messages.find((candidate) => candidate.id === entry.messageId);
        return inviteMessage?.senderPubkey?.trim() === responseSender;
      })
      : candidates;
    const targetPool = inviterSentCandidates.length > 0 ? inviterSentCandidates : candidates;
    const target = pickLatestInviteEntryBeforeResponse(targetPool, responseAtMs);
    const wireInviteId = target?.inviteId;
    if (!wireInviteId || wireInviteId.startsWith("legacy:")) {
      return;
    }
    statusByInviteId.set(wireInviteId, response.status);
  });
};

const applyLegacyInviteResponseLinking = (
  messages: ReadonlyArray<Message>,
  statusByInviteMessageId: Map<string, InviteResponseStatus>,
): void => {
  const { inviteIdentityToMessageId, invites } = buildInviteIndex(messages);

  messages.forEach((message) => {
    const wireResponse = parseInviteResponsePayloadFromMessageContent(message.content);
    if (wireResponse?.inviteId && !wireResponse.inviteId.startsWith("legacy:")) {
      return;
    }
    const parsed = parseJsonPayload(message.content);
    const { groupId, status } = readResponseFields(parsed);
    if (!status || !groupId) {
      return;
    }
    if (replyToResolvesToInvite(message, inviteIdentityToMessageId)) {
      return;
    }
    const responseAtMs = toMessageUnixMs(message);
    const responseSender = message.senderPubkey?.trim();

    if (status === "canceled" && responseSender) {
      const inviterSentInvites = invites.filter((invite) => {
        if (invite.groupId !== groupId || responseAtMs < invite.timestampMs) {
          return false;
        }
        const inviteMessage = messages.find((entry) => entry.id === invite.messageId);
        return inviteMessage?.senderPubkey?.trim() === responseSender;
      });
      const targetInvite = pickLatestInviteEntryBeforeResponse(inviterSentInvites, responseAtMs);
      if (targetInvite) {
        assignInviteMessageStatus(
          invites,
          statusByInviteMessageId,
          targetInvite.messageId,
          status,
          responseAtMs,
        );
        return;
      }
    }

    const counterpartInvites = invites.filter((invite) => (
      invite.groupId === groupId
      && invite.isOutgoing !== message.isOutgoing
    ));
    if (counterpartInvites.length !== 1) {
      return;
    }
    const targetInvite = counterpartInvites[0]!;
    if (responseAtMs >= targetInvite.timestampMs) {
      assignInviteMessageStatus(
        invites,
        statusByInviteMessageId,
        targetInvite.messageId,
        status,
        responseAtMs,
      );
    }
  });
};

/**
 * Maps invite message ids to terminal response status via stable inviteId (+ ledger + legacy fallbacks).
 */
export const buildCommunityInviteResponseStatusByMessageId = (
  messages: ReadonlyArray<Message>,
  conversationId?: string,
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): ReadonlyMap<string, InviteResponseStatus> => {
  const statusByInviteId = new Map<CommunityDmInviteId, InviteResponseStatus>(
    conversationId?.trim()
      ? buildCommunityDmInviteStatusByInviteId(messages, conversationId.trim(), profileId, accountPublicKeyHex)
      : [],
  );

  messages.forEach((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (response) {
      statusByInviteId.set(response.inviteId, response.status);
    }
  });
  propagateLegacyResponseStatusesToWireInviteIds(messages, statusByInviteId);

  const latestResponseAtByInviteId = new Map<CommunityDmInviteId, number>();
  messages.forEach((message) => {
    const response = parseInviteResponsePayloadFromMessageContent(message.content);
    if (!response) {
      return;
    }
    const atMs = toMessageUnixMs(message);
    const existing = latestResponseAtByInviteId.get(response.inviteId);
    if (existing === undefined || atMs > existing) {
      latestResponseAtByInviteId.set(response.inviteId, atMs);
    }
  });

  const latestLedgerTerminalAtByInviteId = new Map<CommunityDmInviteId, number>();
  if (conversationId?.trim()) {
    listCommunityDmInviteLedgerForConversation(conversationId.trim(), profileId, accountPublicKeyHex).forEach((entry) => {
      if (!isTerminalInviteResponseStatus(entry.status)) {
        return;
      }
      const existing = latestLedgerTerminalAtByInviteId.get(entry.inviteId);
      if (existing === undefined || entry.updatedAtUnixMs > existing) {
        latestLedgerTerminalAtByInviteId.set(entry.inviteId, entry.updatedAtUnixMs);
      }
    });
  }

  const inviteCountByInviteId = new Map<CommunityDmInviteId, number>();
  messages.forEach((message) => {
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (!invite) {
      return;
    }
    inviteCountByInviteId.set(invite.inviteId, (inviteCountByInviteId.get(invite.inviteId) ?? 0) + 1);
  });

  const replyToLinkedInviteMessageIds = new Set<string>();
  applyReplyToInviteResponseLinking(messages, new Map(), replyToLinkedInviteMessageIds);

  const statusByInviteMessageId = new Map<string, InviteResponseStatus>();
  messages.forEach((message) => {
    const invite = parseInvitePayloadFromMessageContent(message.content);
    if (!invite) {
      return;
    }
    const duplicateInviteId = (inviteCountByInviteId.get(invite.inviteId) ?? 0) > 1;
    if (duplicateInviteId && !replyToLinkedInviteMessageIds.has(message.id)) {
      return;
    }
    const status = resolveStatusForInviteId(invite, statusByInviteId);
    if (status && status !== "pending") {
      const inviteAtMs = toMessageUnixMs(message);
      const evidenceAtMs = Math.max(
        latestResponseAtByInviteId.get(invite.inviteId) ?? Number.NEGATIVE_INFINITY,
        latestResponseAtByInviteId.get(`legacy:${invite.groupId}` as CommunityDmInviteId) ?? Number.NEGATIVE_INFINITY,
        latestLedgerTerminalAtByInviteId.get(invite.inviteId) ?? Number.NEGATIVE_INFINITY,
        latestLedgerTerminalAtByInviteId.get(`legacy:${invite.groupId}` as CommunityDmInviteId) ?? Number.NEGATIVE_INFINITY,
      );
      if (Number.isFinite(evidenceAtMs) && evidenceAtMs >= inviteAtMs) {
        statusByInviteMessageId.set(message.id, status);
      }
    }
  });

  applyReplyToInviteResponseLinking(messages, statusByInviteMessageId, replyToLinkedInviteMessageIds);
  applyLegacyInviteResponseLinking(messages, statusByInviteMessageId);

  return statusByInviteMessageId;
};

const mergeInvitePayloadParts = (
  primary: InvitePayload | null,
  secondary: InvitePayload | null,
): InvitePayload | null => {
  const base = primary ?? secondary;
  if (!base) {
    return null;
  }
  const roomKey = primary?.roomKey?.trim() || secondary?.roomKey?.trim() || "";
  const metadataName = primary?.metadata.name?.trim() || secondary?.metadata.name?.trim() || "";
  const metadataAbout = primary?.metadata.about?.trim() || secondary?.metadata.about?.trim();
  return {
    ...base,
    roomKey,
    communityId: primary?.communityId ?? secondary?.communityId,
    genesisEventId: primary?.genesisEventId ?? secondary?.genesisEventId,
    creatorPubkey: primary?.creatorPubkey ?? secondary?.creatorPubkey,
    relayUrl: primary?.relayUrl ?? secondary?.relayUrl,
    metadata: {
      ...base.metadata,
      name: metadataName || base.metadata.name,
      about: metadataAbout ?? base.metadata.about,
      picture: primary?.metadata.picture ?? secondary?.metadata.picture,
      access: primary?.metadata.access ?? secondary?.metadata.access,
      memberCount: primary?.metadata.memberCount ?? secondary?.metadata.memberCount,
    },
  };
};

/** Prefer normalized invite from message content (full DM plaintext). */
export const resolveCommunityInvitePayloadFromMessage = (
  message: Message | undefined,
  parsedInvite: unknown,
): InvitePayload | null => {
  const fromContent = message?.content?.trim()
    ? normalizeCommunityInvitePayload(parseJsonPayload(message.content))
    : null;
  const fromParsed = normalizeCommunityInvitePayload(parsedInvite);
  return mergeInvitePayloadParts(fromContent, fromParsed);
};

/** Stable id for invite-response reply tags (prefer nostr rumor event id). */
export const resolveCommunityInviteReplyTargetId = (message: Message): string => (
  message.eventId?.trim() || message.id
);

export const resolveCommunityInviteRoomKeyHex = (
  invite: InvitePayload | null,
  message?: Message,
): string => {
  const fromInvite = invite?.roomKey?.trim() ?? "";
  if (fromInvite) {
    return fromInvite;
  }
  return resolveCommunityInvitePayloadFromMessage(message, invite)?.roomKey?.trim() ?? "";
};

export const resolveCommunityInviteIdFromMessage = (message: Message | undefined): CommunityDmInviteId | null => {
  if (!message?.content?.trim()) {
    return null;
  }
  return parseInvitePayloadFromMessageContent(message.content)?.inviteId ?? null;
};

/** @deprecated Alias resolution kept for tests referencing gift-wrap / rumor ids. */
export const collectCommunityInviteMessageIdentityAliasesForResolution = (
  message: Pick<Message, "id" | "eventId"> & { relayPublishedEventId?: string },
): ReadonlyArray<string> => collectCommunityInviteMessageIdentityAliases(message);
