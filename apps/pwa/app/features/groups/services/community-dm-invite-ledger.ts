import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  CommunityDmInviteId,
  CommunityInviteResolutionStatus,
  CommunityInviteWirePayload,
} from "./community-dm-invite-contract";

const STORAGE_PREFIX = "obscur.community.dm_invite_ledger.v2";

export type CommunityDmInviteLedgerEntry = Readonly<{
  inviteId: CommunityDmInviteId;
  conversationId: string;
  peerPubkey: PublicKeyHex;
  direction: "outbound" | "inbound";
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

const toStorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_PREFIX, profileId ?? getResolvedProfileId())
);

export const loadCommunityDmInviteLedger = (profileId?: string): ReadonlyArray<CommunityDmInviteLedgerEntry> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(toStorageKey(profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is CommunityDmInviteLedgerEntry => (
      !!entry
      && typeof entry === "object"
      && typeof (entry as CommunityDmInviteLedgerEntry).inviteId === "string"
      && typeof (entry as CommunityDmInviteLedgerEntry).conversationId === "string"
    ));
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
    window.localStorage.setItem(toStorageKey(profileId), JSON.stringify(entries));
  } catch {
    // ignore quota
  }
};

export const upsertCommunityDmInviteLedgerEntry = (
  entry: CommunityDmInviteLedgerEntry,
  profileId?: string,
): void => {
  const existing = loadCommunityDmInviteLedger(profileId);
  const next = [
    ...existing.filter((row) => row.inviteId !== entry.inviteId),
    entry,
  ];
  saveCommunityDmInviteLedger(next, profileId);
};

export const updateCommunityDmInviteLedgerStatus = (params: Readonly<{
  inviteId: CommunityDmInviteId;
  status: CommunityInviteResolutionStatus;
  profileId?: string;
}>): CommunityDmInviteLedgerEntry | null => {
  const existing = loadCommunityDmInviteLedger(params.profileId);
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
): CommunityDmInviteLedgerEntry | null => (
  loadCommunityDmInviteLedger(profileId).find((row) => row.inviteId === inviteId) ?? null
);

export const listCommunityDmInviteLedgerForConversation = (
  conversationId: string,
  profileId?: string,
): ReadonlyArray<CommunityDmInviteLedgerEntry> => (
  loadCommunityDmInviteLedger(profileId).filter((row) => row.conversationId === conversationId)
);
