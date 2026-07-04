import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  CommunityDmInviteId,
  CommunityInviteResolutionStatus,
  CommunityInviteWirePayload,
} from "./community-dm-invite-contract";

const LEGACY_STORAGE_PREFIX = "obscur.community.dm_invite_ledger.v2";
const STORAGE_PREFIX = "obscur.community.dm_invite_ledger.v3";

export type CommunityDmInviteLedgerEntry = Readonly<{
  inviteId: CommunityDmInviteId;
  conversationId: string;
  peerPubkey: PublicKeyHex;
  inviterPubkey: PublicKeyHex;
  inviteePubkey: PublicKeyHex;
  /** @deprecated Profile-local ingest hint — not used for role or UI permissions. */
  direction?: "outbound" | "inbound";
  groupId: string;
  groupName: string;
  communityId?: string;
  relayUrl?: string;
  invitePayload: CommunityInviteWirePayload;
  status: CommunityInviteResolutionStatus;
  sentAtUnixMs: number;
  updatedAtUnixMs: number;
  rumorEventId?: string;
}>;

type LegacyCommunityDmInviteLedgerEntry = Readonly<{
  inviteId: CommunityDmInviteId;
  conversationId: string;
  peerPubkey: PublicKeyHex;
  direction: "outbound" | "inbound";
  inviterPubkey?: PublicKeyHex;
  inviteePubkey?: PublicKeyHex;
  groupId: string;
  groupName: string;
  communityId?: string;
  relayUrl?: string;
  invitePayload: CommunityInviteWirePayload;
  status: CommunityInviteResolutionStatus;
  sentAtUnixMs: number;
  updatedAtUnixMs: number;
  rumorEventId?: string;
}>;

const toStorageKey = (prefix: string, profileId?: string): string => (
  getScopedStorageKey(prefix, profileId ?? getResolvedProfileId())
);

const keysMatch = (
  left: PublicKeyHex | string | null | undefined,
  right: PublicKeyHex | string | null | undefined,
): boolean => {
  const normalizedLeft = normalizePublicKeyHex(typeof left === "string" ? left : null);
  const normalizedRight = normalizePublicKeyHex(typeof right === "string" ? right : null);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

export const deriveLegacyLedgerDirectionFromViewer = (
  viewerPublicKeyHex: PublicKeyHex,
  inviterPubkey: PublicKeyHex,
): "outbound" | "inbound" => (
  keysMatch(viewerPublicKeyHex, inviterPubkey) ? "outbound" : "inbound"
);

export const deriveLedgerPeerPubkeyFromViewer = (
  viewerPublicKeyHex: PublicKeyHex,
  inviterPubkey: PublicKeyHex,
  inviteePubkey: PublicKeyHex,
): PublicKeyHex => (
  keysMatch(viewerPublicKeyHex, inviterPubkey) ? inviteePubkey : inviterPubkey
);

export const inferCommunityDmInviteLedgerWireParties = (params: Readonly<{
  peerPubkey: PublicKeyHex;
  direction?: "outbound" | "inbound";
  invitePayload: CommunityInviteWirePayload;
  accountPublicKeyHex?: PublicKeyHex | null;
  inviterPubkey?: PublicKeyHex | null;
  inviteePubkey?: PublicKeyHex | null;
}>): Readonly<{ inviterPubkey: PublicKeyHex; inviteePubkey: PublicKeyHex }> | null => {
  const explicitInviter = normalizePublicKeyHex(params.inviterPubkey ?? null);
  const explicitInvitee = normalizePublicKeyHex(params.inviteePubkey ?? null);
  if (explicitInviter && explicitInvitee) {
    return {
      inviterPubkey: explicitInviter,
      inviteePubkey: explicitInvitee,
    };
  }

  const account = normalizePublicKeyHex(params.accountPublicKeyHex ?? null);
  const peer = normalizePublicKeyHex(params.peerPubkey);
  const creator = normalizePublicKeyHex(params.invitePayload.creatorPubkey ?? null);

  if (creator && peer && account) {
    if (creator === account) {
      return { inviterPubkey: account, inviteePubkey: peer };
    }
    if (creator === peer) {
      return { inviterPubkey: peer, inviteePubkey: account };
    }
  }

  if (account && peer && params.direction === "outbound") {
    return { inviterPubkey: account, inviteePubkey: peer };
  }
  if (account && peer && params.direction === "inbound") {
    return { inviterPubkey: peer, inviteePubkey: account };
  }

  return null;
};

export const normalizeCommunityDmInviteLedgerEntry = (
  raw: unknown,
  accountPublicKeyHex?: PublicKeyHex | null,
): CommunityDmInviteLedgerEntry | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entry = raw as LegacyCommunityDmInviteLedgerEntry;
  if (typeof entry.inviteId !== "string" || typeof entry.conversationId !== "string") {
    return null;
  }
  if (!entry.invitePayload || typeof entry.invitePayload !== "object") {
    return null;
  }

  const wireParties = inferCommunityDmInviteLedgerWireParties({
    peerPubkey: entry.peerPubkey,
    direction: entry.direction,
    invitePayload: entry.invitePayload,
    accountPublicKeyHex,
    inviterPubkey: entry.inviterPubkey,
    inviteePubkey: entry.inviteePubkey,
  });
  if (!wireParties) {
    return null;
  }

  const account = normalizePublicKeyHex(accountPublicKeyHex ?? null);
  const direction = account
    ? deriveLegacyLedgerDirectionFromViewer(account, wireParties.inviterPubkey)
    : entry.direction;

  return {
    inviteId: entry.inviteId,
    conversationId: entry.conversationId,
    peerPubkey: entry.peerPubkey,
    inviterPubkey: wireParties.inviterPubkey,
    inviteePubkey: wireParties.inviteePubkey,
    direction,
    groupId: entry.groupId,
    groupName: entry.groupName,
    communityId: entry.communityId,
    relayUrl: entry.relayUrl,
    invitePayload: entry.invitePayload,
    status: entry.status,
    sentAtUnixMs: entry.sentAtUnixMs,
    updatedAtUnixMs: entry.updatedAtUnixMs,
    rumorEventId: entry.rumorEventId,
  };
};

/** True when the viewing account sent the invite (replaces direction === outbound for display helpers). */
export const isCommunityDmInviteLedgerInviterForViewer = (
  entry: Pick<CommunityDmInviteLedgerEntry, "inviterPubkey" | "direction">,
  viewerPublicKeyHex: PublicKeyHex | null | undefined,
): boolean => {
  const viewer = normalizePublicKeyHex(viewerPublicKeyHex ?? null);
  if (viewer && keysMatch(entry.inviterPubkey, viewer)) {
    return true;
  }
  return entry.direction === "outbound";
};

const readStoredLedger = (prefix: string, profileId?: string): unknown[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(toStorageKey(prefix, profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveCommunityDmInviteLedger = (
  entries: ReadonlyArray<CommunityDmInviteLedgerEntry>,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(toStorageKey(STORAGE_PREFIX, profileId), JSON.stringify(entries));
  } catch {
    // ignore quota
  }
};

const migrateLegacyStorageIfNeeded = (
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const v3Key = toStorageKey(STORAGE_PREFIX, profileId);
  if (window.localStorage.getItem(v3Key)) {
    return;
  }
  const legacyRows = readStoredLedger(LEGACY_STORAGE_PREFIX, profileId);
  if (legacyRows.length === 0) {
    return;
  }
  const migrated = legacyRows
    .map((row) => normalizeCommunityDmInviteLedgerEntry(row, accountPublicKeyHex))
    .filter((row): row is CommunityDmInviteLedgerEntry => row !== null);
  if (migrated.length > 0) {
    saveCommunityDmInviteLedger(migrated, profileId);
  }
  window.localStorage.removeItem(toStorageKey(LEGACY_STORAGE_PREFIX, profileId));
};

export const loadCommunityDmInviteLedger = (
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): ReadonlyArray<CommunityDmInviteLedgerEntry> => {
  if (typeof window === "undefined") {
    return [];
  }
  migrateLegacyStorageIfNeeded(profileId, accountPublicKeyHex);
  return readStoredLedger(STORAGE_PREFIX, profileId)
    .map((row) => normalizeCommunityDmInviteLedgerEntry(row, accountPublicKeyHex))
    .filter((row): row is CommunityDmInviteLedgerEntry => row !== null);
};

export const upsertCommunityDmInviteLedgerEntry = (
  entry: LegacyCommunityDmInviteLedgerEntry,
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): void => {
  const normalized = normalizeCommunityDmInviteLedgerEntry(entry, accountPublicKeyHex);
  if (!normalized) {
    return;
  }
  const existing = loadCommunityDmInviteLedger(profileId, accountPublicKeyHex);
  const next = [
    ...existing.filter((row) => row.inviteId !== normalized.inviteId),
    normalized,
  ];
  saveCommunityDmInviteLedger(next, profileId);
};

export const updateCommunityDmInviteLedgerStatus = (params: Readonly<{
  inviteId: CommunityDmInviteId;
  status: CommunityInviteResolutionStatus;
  profileId?: string;
  accountPublicKeyHex?: PublicKeyHex | null;
}>): CommunityDmInviteLedgerEntry | null => {
  const existing = loadCommunityDmInviteLedger(params.profileId, params.accountPublicKeyHex);
  const index = existing.findIndex((row) => row.inviteId === params.inviteId);
  if (index === -1) {
    return null;
  }
  const updated: CommunityDmInviteLedgerEntry = {
    ...existing[index]!,
    status: params.status,
    updatedAtUnixMs: Date.now(),
  };
  const next = [...existing];
  next[index] = updated;
  saveCommunityDmInviteLedger(next, params.profileId);
  return updated;
};

export const findCommunityDmInviteLedgerEntry = (
  inviteId: CommunityDmInviteId,
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): CommunityDmInviteLedgerEntry | null => (
  loadCommunityDmInviteLedger(profileId, accountPublicKeyHex).find((row) => row.inviteId === inviteId) ?? null
);

export const listCommunityDmInviteLedgerForConversation = (
  conversationId: string,
  profileId?: string,
  accountPublicKeyHex?: PublicKeyHex | null,
): ReadonlyArray<CommunityDmInviteLedgerEntry> => (
  loadCommunityDmInviteLedger(profileId, accountPublicKeyHex).filter((row) => row.conversationId === conversationId)
);
