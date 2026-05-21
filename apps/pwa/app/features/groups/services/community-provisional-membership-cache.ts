import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";
import { dedupeCommunityMemberPubkeys } from "./community-member-roster-projection";

const STORAGE_PREFIX = "obscur.community.provisional_membership.v1";
const DEFAULT_PROVISIONAL_TTL_MS = 3 * 60 * 1000;

type ProvisionalMembershipRecord = Readonly<{
  memberPubkeys: ReadonlyArray<PublicKeyHex>;
  expiresAtUnixMs: number;
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

const parseRecord = (raw: string): ProvisionalMembershipRecord | null => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const memberPubkeys = Array.isArray(parsed.memberPubkeys)
      ? dedupeCommunityMemberPubkeys(
        parsed.memberPubkeys.filter((entry): entry is PublicKeyHex => typeof entry === "string"),
      )
      : [];
    const expiresAtUnixMs = typeof parsed.expiresAtUnixMs === "number" ? parsed.expiresAtUnixMs : 0;
    if (memberPubkeys.length === 0 || !Number.isFinite(expiresAtUnixMs) || expiresAtUnixMs <= Date.now()) {
      return null;
    }
    return {
      memberPubkeys,
      expiresAtUnixMs,
      updatedAtUnixMs: typeof parsed.updatedAtUnixMs === "number" ? parsed.updatedAtUnixMs : Date.now(),
    };
  } catch {
    return null;
  }
};

export const loadCommunityProvisionalMemberPubkeys = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): ReadonlyArray<PublicKeyHex> => {
  if (typeof window === "undefined") {
    return [];
  }
  const key = toStorageKey(params);
  if (!key) {
    return [];
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }
  const record = parseRecord(raw);
  if (!record) {
    window.localStorage.removeItem(key);
    return [];
  }
  return record.memberPubkeys;
};

export const markCommunityProvisionalMembers = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  memberPubkeys: ReadonlyArray<PublicKeyHex | string>;
  ttlMs?: number;
  profileId?: string;
}>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const key = toStorageKey(params);
  if (!key) {
    return;
  }
  const incoming = dedupeCommunityMemberPubkeys(
    params.memberPubkeys
      .map((pubkey) => pubkey.trim())
      .filter((pubkey) => pubkey.length > 0) as ReadonlyArray<PublicKeyHex>,
  );
  if (incoming.length === 0) {
    return;
  }
  const existingRaw = window.localStorage.getItem(key);
  const existing = existingRaw ? parseRecord(existingRaw) : null;
  const memberPubkeys = dedupeCommunityMemberPubkeys([
    ...(existing?.memberPubkeys ?? []),
    ...incoming,
  ]);
  const now = Date.now();
  const ttlMs = typeof params.ttlMs === "number" && Number.isFinite(params.ttlMs) && params.ttlMs > 0
    ? params.ttlMs
    : DEFAULT_PROVISIONAL_TTL_MS;
  const next: ProvisionalMembershipRecord = {
    memberPubkeys,
    expiresAtUnixMs: now + ttlMs,
    updatedAtUnixMs: now,
  };
  window.localStorage.setItem(key, JSON.stringify(next));
};

/**
 * Removes provisional entries that already appear in relay-backed membership evidence (promotion).
 * @returns true if localStorage was mutated.
 */
export const stripProvisionalCommunityMembersConfirmedOnRelay = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  relayBackedMemberPubkeys: ReadonlyArray<PublicKeyHex | string>;
  profileId?: string;
}>): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const key = toStorageKey(params);
  if (!key) {
    return false;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return false;
  }
  const record = parseRecord(raw);
  if (!record) {
    window.localStorage.removeItem(key);
    return true;
  }
  const relaySet = new Set(
    params.relayBackedMemberPubkeys.map((pk) => pk.trim().toLowerCase()).filter((pk) => pk.length > 0),
  );
  const remaining = record.memberPubkeys.filter(
    (pk) => !relaySet.has(pk.trim().toLowerCase()),
  );
  if (remaining.length === record.memberPubkeys.length) {
    return false;
  }
  if (remaining.length === 0) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return true;
  }
  const next: ProvisionalMembershipRecord = {
    memberPubkeys: remaining,
    expiresAtUnixMs: record.expiresAtUnixMs,
    updatedAtUnixMs: Date.now(),
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
  return true;
};

/** Clears the entire provisional overlay for this community (manual reconcile). */
export const clearCommunityProvisionalMembershipRecord = (params: Readonly<{
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const key = toStorageKey(params);
  if (!key) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};
