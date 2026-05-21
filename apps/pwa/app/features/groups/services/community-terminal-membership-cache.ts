import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";
import { dedupeCommunityMemberPubkeys } from "./community-member-roster-projection";

const STORAGE_PREFIX = "obscur.community.terminal_membership.v1";

export type CommunityTerminalMembershipCacheRecord = Readonly<{
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  disbandedAtUnixMs: number | null;
  updatedAtUnixMs: number;
}>;

const toStorageKey = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): string | null => {
  const groupId = params.groupId.trim();
  const relayUrl = normalizeRelayUrl(params.relayUrl).replace(/\/+$/g, "");
  if (!groupId || !relayUrl) {
    return null;
  }
  return getScopedStorageKey(`${STORAGE_PREFIX}.${groupId}@@${relayUrl}`, params.profileId ?? getResolvedProfileId());
};

export const mergeTerminalMemberPubkeys = (
  ...lists: ReadonlyArray<ReadonlyArray<PublicKeyHex | string>>
): ReadonlyArray<PublicKeyHex> => (
  dedupeCommunityMemberPubkeys(
    lists.flatMap((list) => list.map((pubkey) => pubkey.trim()).filter((pubkey) => pubkey.length > 0)) as ReadonlyArray<PublicKeyHex>,
  )
);

export const loadCommunityTerminalMembershipCache = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): CommunityTerminalMembershipCacheRecord | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const key = toStorageKey(params);
  if (!key) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const leftMemberPubkeys = Array.isArray(record.leftMemberPubkeys)
      ? dedupeCommunityMemberPubkeys(record.leftMemberPubkeys.filter((entry): entry is PublicKeyHex => typeof entry === "string"))
      : [];
    const expelledMemberPubkeys = Array.isArray(record.expelledMemberPubkeys)
      ? dedupeCommunityMemberPubkeys(record.expelledMemberPubkeys.filter((entry): entry is PublicKeyHex => typeof entry === "string"))
      : [];
    const disbandedAtUnixMs = typeof record.disbandedAtUnixMs === "number" ? record.disbandedAtUnixMs : null;
    const updatedAtUnixMs = typeof record.updatedAtUnixMs === "number" ? record.updatedAtUnixMs : 0;
    if (leftMemberPubkeys.length === 0 && expelledMemberPubkeys.length === 0 && disbandedAtUnixMs === null) {
      return null;
    }
    return {
      leftMemberPubkeys,
      expelledMemberPubkeys,
      disbandedAtUnixMs,
      updatedAtUnixMs,
    };
  } catch {
    return null;
  }
};

/** Remove pubkeys from terminal left/expelled evidence (e.g. after a successful re-invite). */
export const reinstateCommunityMemberTerminalEvidence = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  memberPubkeys: ReadonlyArray<PublicKeyHex | string>;
  profileId?: string;
}>): void => {
  const reinstateSet = new Set(
    params.memberPubkeys.map((pubkey) => pubkey.trim().toLowerCase()).filter((pubkey) => pubkey.length > 0),
  );
  if (reinstateSet.size === 0) {
    return;
  }
  const existing = loadCommunityTerminalMembershipCache({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    profileId: params.profileId,
  });
  if (!existing) {
    return;
  }
  const leftMemberPubkeys = existing.leftMemberPubkeys.filter(
    (pubkey) => !reinstateSet.has(pubkey.trim().toLowerCase()),
  );
  const expelledMemberPubkeys = existing.expelledMemberPubkeys.filter(
    (pubkey) => !reinstateSet.has(pubkey.trim().toLowerCase()),
  );
  saveCommunityTerminalMembershipCache({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    leftMemberPubkeys,
    expelledMemberPubkeys,
    disbandedAtUnixMs: existing.disbandedAtUnixMs,
    profileId: params.profileId,
  });
};

export const saveCommunityTerminalMembershipCache = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex | string>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex | string>;
  disbandedAtUnixMs?: number | null;
  profileId?: string;
}>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const key = toStorageKey(params);
  if (!key) {
    return;
  }
  const leftMemberPubkeys = mergeTerminalMemberPubkeys(params.leftMemberPubkeys);
  const expelledMemberPubkeys = mergeTerminalMemberPubkeys(params.expelledMemberPubkeys);
  const disbandedAtUnixMs = typeof params.disbandedAtUnixMs === "number" ? params.disbandedAtUnixMs : null;
  if (leftMemberPubkeys.length === 0 && expelledMemberPubkeys.length === 0 && disbandedAtUnixMs === null) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  const record: CommunityTerminalMembershipCacheRecord = {
    leftMemberPubkeys,
    expelledMemberPubkeys,
    disbandedAtUnixMs,
    updatedAtUnixMs: Date.now(),
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // ignore quota / private mode
  }
};

/**
 * Clears terminal left/expelled cache entries for members with relay or chat participation evidence.
 * @returns true when localStorage terminal record was updated.
 */
export const stripTerminalCommunityMembersWithActiveEvidence = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  relayBackedMemberPubkeys?: ReadonlyArray<PublicKeyHex | string>;
  conversationAuthorPubkeys?: ReadonlyArray<PublicKeyHex | string>;
  profileId?: string;
}>): boolean => {
  const before = loadCommunityTerminalMembershipCache({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    profileId: params.profileId,
  });
  if (!before) {
    return false;
  }
  const reinstatePubkeys = mergeTerminalMemberPubkeys(
    params.relayBackedMemberPubkeys ?? [],
    params.conversationAuthorPubkeys ?? [],
  );
  if (reinstatePubkeys.length === 0) {
    return false;
  }
  reinstateCommunityMemberTerminalEvidence({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    memberPubkeys: reinstatePubkeys,
    profileId: params.profileId,
  });
  const after = loadCommunityTerminalMembershipCache({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    profileId: params.profileId,
  });
  const beforeKey = JSON.stringify(before);
  const afterKey = JSON.stringify(after);
  return beforeKey !== afterKey;
};

/** Removes persisted terminal left/expelled evidence for this community scope. */
export const clearCommunityTerminalMembershipCache = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): void => {
  saveCommunityTerminalMembershipCache({
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    leftMemberPubkeys: [],
    expelledMemberPubkeys: [],
    disbandedAtUnixMs: null,
    profileId: params.profileId,
  });
};
