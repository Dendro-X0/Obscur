import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";
import type { PersistedChatState, PersistedGroupMessage, PersistedMessage } from "@/app/features/messaging/types";
import { fromPersistedGroupConversation } from "@/app/features/messaging/utils/persistence";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  mergeCommunityMembershipLedgerEntries,
  toCommunityMembershipLedgerEntryFromGroup,
  toCommunityMembershipLedgerKey,
} from "./community-membership-ledger";

type InvitePayload = Readonly<{
  type: "community-invite";
  groupId?: string;
  roomKey?: string;
  relayUrl?: string;
  communityId?: string;
  metadata?: Readonly<{
    name?: string;
    picture?: string;
  }>;
}>;

type InviteResponsePayload = Readonly<{
  type: "community-invite-response";
  status?: string;
  groupId?: string;
  relayUrl?: string;
  communityId?: string;
}>;

export type ReconstructedRoomKeySnapshot = Readonly<{
  groupId: string;
  roomKeyHex: string;
  previousKeys?: ReadonlyArray<string>;
  createdAt: number;
}>;

type InviteMetadataSnapshot = Readonly<{
  displayName?: string;
  avatar?: string;
}>;

const HASHED_COMMUNITY_ID_PATTERN = /^v2_[0-9a-f]{64}$/i;

const normalizeRelayForIdentity = (relayUrl: string): string => {
  const trimmed = relayUrl.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const withScheme = trimmed.startsWith("ws://") || trimmed.startsWith("wss://")
    ? trimmed
    : `wss://${trimmed}`;
  return normalizeRelayUrl(withScheme);
};

const sanitizeMembershipIdentity = (params: Readonly<{
  groupId: unknown;
  relayUrl: unknown;
  communityId: unknown;
}>): Readonly<{
  groupId: string;
  relayUrl: string;
  communityId: string;
}> | null => {
  const groupId = typeof params.groupId === "string" ? params.groupId.trim() : "";
  const relayUrl = typeof params.relayUrl === "string" ? params.relayUrl.trim() : "";
  if (groupId.length === 0 || relayUrl.length === 0) {
    return null;
  }
  const communityId = deriveCommunityId({
    existingCommunityId: typeof params.communityId === "string" ? params.communityId : undefined,
    groupId,
    relayUrl,
  });
  return { groupId, relayUrl, communityId };
};

const parseGroupIdentityFromConversationId = (
  conversationId: string,
): Readonly<{ groupId: string; relayUrl: string; communityId: string }> | null => {
  const trimmed = conversationId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.startsWith("community:") || trimmed.startsWith("group:")) {
    const raw = trimmed.startsWith("community:")
      ? trimmed.slice("community:".length)
      : trimmed.slice("group:".length);
    const candidate = raw.trim();
    if (HASHED_COMMUNITY_ID_PATTERN.test(candidate)) {
      return null;
    }
    const separatorIndex = candidate.indexOf(":");
    if (separatorIndex <= 0) {
      return null;
    }
    const groupId = candidate.slice(0, separatorIndex).trim();
    const relayUrl = normalizeRelayForIdentity(candidate.slice(separatorIndex + 1));
    if (groupId.length === 0 || relayUrl.length === 0) {
      return null;
    }
    return {
      groupId,
      relayUrl,
      communityId: deriveCommunityId({
        groupId,
        relayUrl,
      }),
    };
  }

  if (trimmed.includes("@")) {
    const [rawGroupId, ...relayParts] = trimmed.split("@");
    const groupId = rawGroupId.trim();
    const relayUrl = normalizeRelayForIdentity(relayParts.join("@"));
    if (groupId.length === 0 || relayUrl.length === 0) {
      return null;
    }
    return {
      groupId,
      relayUrl,
      communityId: deriveCommunityId({
        groupId,
        relayUrl,
      }),
    };
  }

  return null;
};

const toUnixMsFromGroupMessageCreatedAt = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  // Group message timestamps are typically unix seconds.
  return value < 1_000_000_000_000 ? value * 1000 : value;
};

const resolveLatestGroupMessageUnixMs = (messages: ReadonlyArray<PersistedGroupMessage>): number => {
  let latestUnixMs = 0;
  for (const message of messages) {
    const candidateUnixMs = toUnixMsFromGroupMessageCreatedAt(message.created_at);
    if (candidateUnixMs > latestUnixMs) {
      latestUnixMs = candidateUnixMs;
    }
  }
  return latestUnixMs;
};

const parseInvitePayload = (
  content: string,
): InvitePayload | InviteResponsePayload | null => {
  try {
    const parsed = JSON.parse(content) as InvitePayload | InviteResponsePayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const toInviteEvidenceEntry = (
  message: PersistedMessage,
  options?: Readonly<{
    allowOutgoingAcceptedResponse?: boolean;
  }>,
): CommunityMembershipLedgerEntry | null => {
  if (typeof message.content !== "string" || message.content.trim().length === 0) {
    return null;
  }
  const parsed = parseInvitePayload(message.content);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const updatedAtUnixMs = Number.isFinite(message.timestampMs) && message.timestampMs > 0
    ? message.timestampMs
    : Date.now();

  if (parsed.type === "community-invite") {
    if (!message.isOutgoing) {
      return null;
    }
    const identity = sanitizeMembershipIdentity({
      groupId: parsed.groupId,
      relayUrl: parsed.relayUrl,
      communityId: parsed.communityId,
    });
    if (!identity) {
      return null;
    }
    const displayName = typeof parsed.metadata?.name === "string" && parsed.metadata.name.trim().length > 0
      ? parsed.metadata.name.trim()
      : undefined;
    const avatar = typeof parsed.metadata?.picture === "string" && parsed.metadata.picture.trim().length > 0
      ? parsed.metadata.picture.trim()
      : undefined;
    return {
      ...identity,
      status: "joined",
      updatedAtUnixMs,
      displayName,
      avatar,
    };
  }

  if (parsed.type === "community-invite-response") {
    if (parsed.status !== "accepted") {
      return null;
    }
    if (message.isOutgoing && options?.allowOutgoingAcceptedResponse !== true) {
      return null;
    }
    const identity = sanitizeMembershipIdentity({
      groupId: parsed.groupId,
      relayUrl: parsed.relayUrl,
      communityId: parsed.communityId,
    });
    if (!identity) {
      return null;
    }
    return {
      ...identity,
      status: "joined",
      updatedAtUnixMs,
    };
  }

  return null;
};

const toInviteRoomKeyIdentityKey = (
  message: PersistedMessage,
): string | null => {
  if (typeof message.content !== "string" || message.content.trim().length === 0) {
    return null;
  }
  const parsed = parseInvitePayload(message.content);
  if (!parsed || typeof parsed !== "object" || parsed.type !== "community-invite") {
    return null;
  }
  if (typeof parsed.roomKey !== "string" || parsed.roomKey.trim().length === 0) {
    return null;
  }
  const identity = sanitizeMembershipIdentity({
    groupId: parsed.groupId,
    relayUrl: parsed.relayUrl,
    communityId: parsed.communityId,
  });
  if (!identity) {
    return null;
  }
  return toCommunityMembershipLedgerKey(identity);
};

const toInviteMetadataSnapshot = (
  message: PersistedMessage,
): Readonly<{ identityKey: string; metadata: InviteMetadataSnapshot }> | null => {
  if (typeof message.content !== "string" || message.content.trim().length === 0) {
    return null;
  }
  const parsed = parseInvitePayload(message.content);
  if (!parsed || parsed.type !== "community-invite") {
    return null;
  }
  const identity = sanitizeMembershipIdentity({
    groupId: parsed.groupId,
    relayUrl: parsed.relayUrl,
    communityId: parsed.communityId,
  });
  if (!identity) {
    return null;
  }
  const displayName = typeof parsed.metadata?.name === "string" && parsed.metadata.name.trim().length > 0
    ? parsed.metadata.name.trim()
    : undefined;
  const avatar = typeof parsed.metadata?.picture === "string" && parsed.metadata.picture.trim().length > 0
    ? parsed.metadata.picture.trim()
    : undefined;
  return {
    identityKey: toCommunityMembershipLedgerKey(identity),
    metadata: {
      displayName,
      avatar,
    },
  };
};

const toInviteRoomKeyEntry = (
  message: PersistedMessage,
): ReconstructedRoomKeySnapshot | null => {
  if (typeof message.content !== "string" || message.content.trim().length === 0) {
    return null;
  }
  let parsed: InvitePayload | null = null;
  try {
    parsed = JSON.parse(message.content) as InvitePayload;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || parsed.type !== "community-invite") {
    return null;
  }
  const groupId = typeof parsed.groupId === "string" ? parsed.groupId.trim() : "";
  const roomKeyHex = typeof parsed.roomKey === "string" ? parsed.roomKey.trim() : "";
  if (groupId.length === 0 || roomKeyHex.length === 0) {
    return null;
  }
  const createdAt = Number.isFinite(message.timestampMs) && message.timestampMs > 0
    ? message.timestampMs
    : Date.now();
  return {
    groupId,
    roomKeyHex,
    createdAt,
  };
};

export const reconstructRoomKeysFromChatState = (
  chatState: PersistedChatState | null | undefined,
): ReadonlyArray<ReconstructedRoomKeySnapshot> => {
  if (!chatState) {
    return [];
  }
  const byGroupId = new Map<string, ReconstructedRoomKeySnapshot>();
  for (const timeline of Object.values(chatState.messagesByConversationId ?? {})) {
    for (const message of timeline) {
      const reconstructed = toInviteRoomKeyEntry(message);
      if (!reconstructed) {
        continue;
      }
      const existing = byGroupId.get(reconstructed.groupId);
      if (!existing) {
        byGroupId.set(reconstructed.groupId, reconstructed);
        continue;
      }
      const incomingWins = reconstructed.createdAt >= existing.createdAt;
      const latest = incomingWins ? reconstructed : existing;
      const older = incomingWins ? existing : reconstructed;
      const mergedPrevious = Array.from(new Set([
        ...(latest.previousKeys ?? []),
        ...(older.previousKeys ?? []),
        older.roomKeyHex,
      ].filter((value) => value.trim().length > 0 && value !== latest.roomKeyHex)));
      byGroupId.set(reconstructed.groupId, {
        groupId: latest.groupId,
        roomKeyHex: latest.roomKeyHex,
        createdAt: latest.createdAt,
        ...(mergedPrevious.length > 0 ? { previousKeys: mergedPrevious } : {}),
      });
    }
  }
  return Array.from(byGroupId.values()).sort((left, right) => left.groupId.localeCompare(right.groupId));
};

export const reconstructCommunityMembershipFromChatState = (
  chatState: PersistedChatState | null | undefined,
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  if (!chatState) {
    return [];
  }
  const candidates: CommunityMembershipLedgerEntry[] = [];
  const roomKeyInviteIdentityKeys = new Set<string>();
  const inviteMetadataByIdentityKey = new Map<string, InviteMetadataSnapshot>();

  for (const persistedGroup of chatState.createdGroups ?? []) {
    try {
      const group = fromPersistedGroupConversation(persistedGroup);
      candidates.push(
        toCommunityMembershipLedgerEntryFromGroup(group, {
          status: "joined",
          updatedAtUnixMs: Number.isFinite(persistedGroup.lastMessageTimeMs) && persistedGroup.lastMessageTimeMs > 0
            ? persistedGroup.lastMessageTimeMs
            : Date.now(),
        }),
      );
    } catch {
      // Ignore malformed persisted group rows.
    }
  }

  for (const timeline of Object.values(chatState.messagesByConversationId ?? {})) {
    for (const message of timeline) {
      const roomKeyInviteIdentityKey = toInviteRoomKeyIdentityKey(message);
      if (roomKeyInviteIdentityKey) {
        roomKeyInviteIdentityKeys.add(roomKeyInviteIdentityKey);
      }
      const inviteMetadataSnapshot = toInviteMetadataSnapshot(message);
      if (inviteMetadataSnapshot) {
        const existingMetadata = inviteMetadataByIdentityKey.get(inviteMetadataSnapshot.identityKey);
        inviteMetadataByIdentityKey.set(inviteMetadataSnapshot.identityKey, {
          displayName: inviteMetadataSnapshot.metadata.displayName ?? existingMetadata?.displayName,
          avatar: inviteMetadataSnapshot.metadata.avatar ?? existingMetadata?.avatar,
        });
      }
    }
  }

  for (const timeline of Object.values(chatState.messagesByConversationId ?? {})) {
    for (const message of timeline) {
      const parsed = typeof message.content === "string"
        ? parseInvitePayload(message.content)
        : null;
      const inviteEvidence = toInviteEvidenceEntry(message, {
        allowOutgoingAcceptedResponse: (
          !!parsed
          && parsed.type === "community-invite-response"
          && parsed.status === "accepted"
          && (() => {
            const identity = sanitizeMembershipIdentity({
              groupId: parsed.groupId,
              relayUrl: parsed.relayUrl,
              communityId: parsed.communityId,
            });
            return identity ? roomKeyInviteIdentityKeys.has(toCommunityMembershipLedgerKey(identity)) : false;
          })()
        ),
      });
      if (inviteEvidence) {
        const matchedInviteMetadata = inviteMetadataByIdentityKey.get(
          toCommunityMembershipLedgerKey(inviteEvidence),
        );
        candidates.push({
          ...inviteEvidence,
          displayName: inviteEvidence.displayName ?? matchedInviteMetadata?.displayName,
          avatar: inviteEvidence.avatar ?? matchedInviteMetadata?.avatar,
        });
      }
    }
  }

  for (const [conversationId, messages] of Object.entries(chatState.groupMessages ?? {})) {
    const identity = parseGroupIdentityFromConversationId(conversationId);
    if (!identity) {
      continue;
    }
    candidates.push({
      ...identity,
      status: "joined",
      updatedAtUnixMs: resolveLatestGroupMessageUnixMs(messages) || Date.now(),
    });
  }

  return mergeCommunityMembershipLedgerEntries([], candidates);
};

export const supplementMembershipLedgerEntries = (params: Readonly<{
  explicitEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  supplementalEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
}>): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const explicitKeys = new Set(params.explicitEntries.map((entry) => toCommunityMembershipLedgerKey(entry)));
  const supplemental = params.supplementalEntries.filter((entry) => !explicitKeys.has(toCommunityMembershipLedgerKey(entry)));
  return mergeCommunityMembershipLedgerEntries(params.explicitEntries, supplemental);
};
