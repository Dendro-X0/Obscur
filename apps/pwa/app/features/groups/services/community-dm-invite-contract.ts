import type { GroupAccessMode, GroupMetadata } from "../types";

/** Stable correlation id for invite + response on the wire and in local ledger. */
export type CommunityDmInviteId = string & { readonly __brand: "CommunityDmInviteId" };

export type CommunityInviteWirePayload = Readonly<{
  type: "community-invite";
  inviteId: CommunityDmInviteId;
  groupId: string;
  roomKey: string;
  metadata: GroupMetadata;
  relayUrl?: string;
  communityId?: string;
  genesisEventId?: string;
  creatorPubkey?: string;
}>;

export type CommunityInviteResponseWirePayload = Readonly<{
  type: "community-invite-response";
  inviteId: CommunityDmInviteId;
  status: "accepted" | "declined" | "canceled";
  groupId: string;
  relayUrl?: string;
  communityId?: string;
}>;

export type CommunityInviteResolutionStatus = "pending" | "accepted" | "declined" | "canceled";

export const createCommunityDmInviteId = (): CommunityDmInviteId => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID() as CommunityDmInviteId;
  }
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` as CommunityDmInviteId;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parseCommunityInviteWirePayload = (raw: unknown): CommunityInviteWirePayload | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== "community-invite") {
    return null;
  }
  const inviteId = readString(record.inviteId) as CommunityDmInviteId | undefined;
  const groupId = readString(record.groupId);
  const roomKey = readString(record.roomKey) ?? readString(record.roomKeyHex);
  if (!groupId || !roomKey) {
    return null;
  }
  const metadataRaw = record.metadata && typeof record.metadata === "object"
    ? record.metadata as Record<string, unknown>
    : {};
  const metadataId = readString(metadataRaw.id) ?? groupId;
  return {
    type: "community-invite",
    inviteId: inviteId ?? (`legacy:${groupId}` as CommunityDmInviteId),
    groupId,
    roomKey,
    metadata: {
      id: metadataId,
      name: readString(metadataRaw.name) ?? readString(record.name) ?? "Community",
      about: readString(metadataRaw.about) ?? readString(record.about),
      picture: readString(metadataRaw.picture) ?? readString(record.picture),
      access: (readString(metadataRaw.access) ?? readString(record.access) ?? "invite-only") as GroupAccessMode,
    },
    relayUrl: readString(record.relayUrl),
    communityId: readString(record.communityId),
    genesisEventId: readString(record.genesisEventId),
    creatorPubkey: readString(record.creatorPubkey),
  };
};

export const parseCommunityInviteResponseWirePayload = (
  raw: unknown,
): CommunityInviteResponseWirePayload | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (record.type !== "community-invite-response") {
    return null;
  }
  const status = record.status;
  if (status !== "accepted" && status !== "declined" && status !== "canceled") {
    return null;
  }
  const groupId = readString(record.groupId);
  if (!groupId) {
    return null;
  }
  const inviteId = readString(record.inviteId) as CommunityDmInviteId | undefined;
  return {
    type: "community-invite-response",
    inviteId: inviteId ?? (`legacy:${groupId}:${status}` as CommunityDmInviteId),
    status,
    groupId,
    relayUrl: readString(record.relayUrl),
    communityId: readString(record.communityId),
  };
};

export const parseMessageContentJson = (content: string): unknown => {
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
  return candidate;
};

export const buildCommunityInviteWirePlaintext = (
  payload: CommunityInviteWirePayload,
): string => JSON.stringify(payload);

export const buildCommunityInviteResponseWirePlaintext = (
  payload: CommunityInviteResponseWirePayload,
): string => JSON.stringify(payload);
