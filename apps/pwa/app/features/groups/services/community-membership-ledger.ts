import type { GroupConversation } from "@/app/features/messaging/types";
import { getActiveProfileIdSafe, getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { logAppEvent } from "@/app/shared/log-app-event";
import { deriveCommunityId } from "../utils/community-identity";
import { toGroupConversationId } from "../utils/group-conversation-id";

const MEMBERSHIP_LEDGER_STORAGE_PREFIX = "obscur.group.membership_ledger.v1";
export const LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE = "Group key unavailable on this device";
export const COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT = "obscur:community-membership-ledger-updated";
const ledgerLoadSignatureByScope = new Map<string, string>();

export type CommunityMembershipStatus = "joined" | "left" | "expelled";

export type CommunityMembershipLedgerEntry = Readonly<{
  communityId: string;
  groupId: string;
  relayUrl: string;
  status: CommunityMembershipStatus;
  updatedAtUnixMs: number;
  lastEvidenceEventId?: string;
  displayName?: string;
  avatar?: string;
}>;

const normalizeRelayUrl = (relayUrl: string | null | undefined): string => {
  const trimmed = (relayUrl ?? "").trim();
  return trimmed.length > 0 ? trimmed : "unknown";
};

const isCommunityMembershipStatus = (value: unknown): value is CommunityMembershipStatus => (
  value === "joined" || value === "left" || value === "expelled"
);

export const toCommunityMembershipLedgerKey = (
  params: Readonly<{ groupId: string; relayUrl: string }>
): string => `${params.groupId.trim()}@@${normalizeRelayUrl(params.relayUrl)}`;

const toLegacyStorageKey = (publicKeyHex: string): string => (
  `${MEMBERSHIP_LEDGER_STORAGE_PREFIX}.${publicKeyHex}`
);

const toStorageKey = (publicKeyHex: string): string => (
  getScopedStorageKey(toLegacyStorageKey(publicKeyHex))
);

const toPublicKeySuffix = (publicKeyHex: string): string => publicKeyHex.slice(-8);

const normalizeCommunityMembershipLedgerEntry = (value: unknown): CommunityMembershipLedgerEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<CommunityMembershipLedgerEntry>;
  const groupId = typeof candidate.groupId === "string" ? candidate.groupId.trim() : "";
  const relayUrl = typeof candidate.relayUrl === "string" ? candidate.relayUrl.trim() : "";
  if (groupId.length === 0 || relayUrl.length === 0) {
    return null;
  }
  const communityId = deriveCommunityId({
    existingCommunityId: typeof candidate.communityId === "string" ? candidate.communityId.trim() : undefined,
    groupId,
    relayUrl,
  });
  const updatedAtUnixMs = Number.isFinite(candidate.updatedAtUnixMs)
    ? Number(candidate.updatedAtUnixMs)
    : Date.now();
  const lastEvidenceEventId = typeof candidate.lastEvidenceEventId === "string" && candidate.lastEvidenceEventId.trim().length > 0
    ? candidate.lastEvidenceEventId.trim()
    : undefined;
  const displayName = typeof candidate.displayName === "string" && candidate.displayName.trim().length > 0
    ? candidate.displayName.trim()
    : undefined;
  const avatar = typeof candidate.avatar === "string" && candidate.avatar.trim().length > 0
    ? candidate.avatar.trim()
    : undefined;

  return {
    communityId,
    groupId,
    relayUrl,
    status: isCommunityMembershipStatus(candidate.status) ? candidate.status : "joined",
    updatedAtUnixMs: Number.isFinite(updatedAtUnixMs) && updatedAtUnixMs > 0 ? updatedAtUnixMs : Date.now(),
    lastEvidenceEventId,
    displayName,
    avatar,
  };
};

const dedupeCommunityMembershipLedger = (
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const byKey = new Map<string, CommunityMembershipLedgerEntry>();
  for (const entry of entries) {
    const normalized = normalizeCommunityMembershipLedgerEntry(entry);
    if (!normalized) {
      continue;
    }
    const key = toCommunityMembershipLedgerKey(normalized);
    const existing = byKey.get(key);
    if (!existing || normalized.updatedAtUnixMs >= existing.updatedAtUnixMs) {
      byKey.set(key, normalized);
    }
  }
  return Array.from(byKey.values()).sort((left, right) => right.updatedAtUnixMs - left.updatedAtUnixMs);
};

export const parseCommunityMembershipLedgerSnapshot = (
  value: unknown
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return dedupeCommunityMembershipLedger(value);
};

export const mergeCommunityMembershipLedgerEntries = (
  current: ReadonlyArray<CommunityMembershipLedgerEntry>,
  incoming: ReadonlyArray<CommunityMembershipLedgerEntry>
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  return dedupeCommunityMembershipLedger([...current, ...incoming]);
};

export const selectJoinedCommunityMembershipLedgerEntries = (
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>
): ReadonlyArray<CommunityMembershipLedgerEntry> => (
  entries.filter((entry) => entry.status === "joined")
);

const readCommunityMembershipLedger = (publicKeyHex: string): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  if (typeof window === "undefined") {
    return [];
  }
  const profileId = getActiveProfileIdSafe();
  try {
    const scopedRaw = window.localStorage.getItem(toStorageKey(publicKeyHex));
    const legacyRaw = window.localStorage.getItem(toLegacyStorageKey(publicKeyHex));

    const scopedEntries = scopedRaw
      ? parseCommunityMembershipLedgerSnapshot(JSON.parse(scopedRaw))
      : [];
    const legacyEntries = legacyRaw
      ? parseCommunityMembershipLedgerSnapshot(JSON.parse(legacyRaw))
      : [];

    if (scopedEntries.length === 0 && legacyEntries.length === 0) {
      const emptySignature = `profile:${profileId}|scoped:0|legacy:0|merged:0`;
      const scopeKey = `${publicKeyHex}::${profileId}`;
      if (ledgerLoadSignatureByScope.get(scopeKey) !== emptySignature) {
        ledgerLoadSignatureByScope.set(scopeKey, emptySignature);
        logAppEvent({
          name: "groups.membership_ledger_load",
          level: "info",
          scope: { feature: "groups", action: "membership_ledger" },
          context: {
            publicKeySuffix: toPublicKeySuffix(publicKeyHex),
            profileId,
            scopedEntryCount: 0,
            legacyEntryCount: 0,
            mergedEntryCount: 0,
          },
        });
      }
      return [];
    }
    const mergedEntries = mergeCommunityMembershipLedgerEntries(scopedEntries, legacyEntries);
    const signature = `profile:${profileId}|scoped:${scopedEntries.length}|legacy:${legacyEntries.length}|merged:${mergedEntries.length}`;
    const scopeKey = `${publicKeyHex}::${profileId}`;
    if (ledgerLoadSignatureByScope.get(scopeKey) !== signature) {
      ledgerLoadSignatureByScope.set(scopeKey, signature);
      logAppEvent({
        name: "groups.membership_ledger_load",
        level: "info",
        scope: { feature: "groups", action: "membership_ledger" },
        context: {
          publicKeySuffix: toPublicKeySuffix(publicKeyHex),
          profileId,
          scopedEntryCount: scopedEntries.length,
          legacyEntryCount: legacyEntries.length,
          mergedEntryCount: mergedEntries.length,
        },
      });
    }
    return mergedEntries;
  } catch {
    return [];
  }
};

export const loadCommunityMembershipLedger = (
  publicKeyHex: string
): ReadonlyArray<CommunityMembershipLedgerEntry> => readCommunityMembershipLedger(publicKeyHex);

export const saveCommunityMembershipLedger = (
  publicKeyHex: string,
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const normalizedEntries = dedupeCommunityMembershipLedger(entries);
    const serialized = JSON.stringify(normalizedEntries);
    const storageKey = toStorageKey(publicKeyHex);
    const legacyStorageKey = toLegacyStorageKey(publicKeyHex);
    const existingScoped = window.localStorage.getItem(storageKey);
    const existingLegacy = window.localStorage.getItem(legacyStorageKey);
    const isSnapshotUnchanged = existingScoped === serialized || existingLegacy === serialized;

    if (existingScoped !== serialized) {
      window.localStorage.setItem(storageKey, serialized);
    }
    if (existingLegacy !== serialized) {
      // Keep account-scoped fallback stable across profile-scope transitions.
      window.localStorage.setItem(legacyStorageKey, serialized);
    }

    if (isSnapshotUnchanged) {
      return;
    }
    logAppEvent({
      name: "groups.membership_ledger_save",
      level: "info",
      scope: { feature: "groups", action: "membership_ledger" },
      context: {
        publicKeySuffix: toPublicKeySuffix(publicKeyHex),
        profileId: getActiveProfileIdSafe(),
        savedEntryCount: normalizedEntries.length,
      },
    });
    window.dispatchEvent(new CustomEvent(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, {
      detail: { publicKeyHex },
    }));
    emitAccountSyncMutation("community_membership_changed");
  } catch {
    return;
  }
};

export const upsertCommunityMembershipLedgerEntry = (
  publicKeyHex: string,
  entry: CommunityMembershipLedgerEntry
): void => {
  const current = readCommunityMembershipLedger(publicKeyHex);
  const next = mergeCommunityMembershipLedgerEntries(current, [entry]);
  saveCommunityMembershipLedger(publicKeyHex, next);
};

export const setCommunityMembershipStatus = (
  publicKeyHex: string,
  params: Readonly<{
    groupId: string;
    relayUrl: string;
    communityId?: string;
    status: CommunityMembershipStatus;
    updatedAtUnixMs?: number;
    displayName?: string;
    avatar?: string;
    lastEvidenceEventId?: string;
  }>
): void => {
  const communityId = deriveCommunityId({
    existingCommunityId: params.communityId,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
  });
  upsertCommunityMembershipLedgerEntry(publicKeyHex, {
    communityId,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    status: params.status,
    updatedAtUnixMs: params.updatedAtUnixMs ?? Date.now(),
    displayName: params.displayName,
    avatar: params.avatar,
    lastEvidenceEventId: params.lastEvidenceEventId,
  });
};

export const toCommunityMembershipLedgerEntryFromGroup = (
  group: GroupConversation,
  options?: Readonly<{
    status?: CommunityMembershipStatus;
    updatedAtUnixMs?: number;
    lastEvidenceEventId?: string;
  }>
): CommunityMembershipLedgerEntry => ({
  communityId: deriveCommunityId({
    existingCommunityId: group.communityId,
    groupId: group.groupId,
    relayUrl: group.relayUrl,
    genesisEventId: group.genesisEventId,
    creatorPubkey: group.creatorPubkey,
  }),
  groupId: group.groupId,
  relayUrl: group.relayUrl,
  status: options?.status ?? "joined",
  updatedAtUnixMs: options?.updatedAtUnixMs ?? Date.now(),
  lastEvidenceEventId: options?.lastEvidenceEventId,
  displayName: group.displayName,
  avatar: group.avatar,
});

export const toGroupConversationFromMembershipLedgerEntry = (
  entry: CommunityMembershipLedgerEntry,
  options?: Readonly<{
    fallbackDisplayName?: string;
    fallbackMemberPubkeys?: ReadonlyArray<string>;
  }>
): GroupConversation => {
  const communityId = deriveCommunityId({
    existingCommunityId: entry.communityId,
    groupId: entry.groupId,
    relayUrl: entry.relayUrl,
  });
  const id = toGroupConversationId({
    groupId: entry.groupId,
    relayUrl: entry.relayUrl,
    communityId,
  });
  const fallbackMemberPubkeys = Array.from(new Set((options?.fallbackMemberPubkeys ?? []).map((pubkey) => pubkey.trim()).filter((pubkey) => pubkey.length > 0)));
  const memberCount = Math.max(fallbackMemberPubkeys.length, 1);
  return {
    kind: "group",
    id,
    communityId,
    groupId: entry.groupId,
    relayUrl: entry.relayUrl,
    displayName: entry.displayName ?? options?.fallbackDisplayName ?? "Private Group",
    memberPubkeys: fallbackMemberPubkeys,
    lastMessage: LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE,
    unreadCount: 0,
    lastMessageTime: new Date(entry.updatedAtUnixMs),
    access: "invite-only",
    memberCount,
    adminPubkeys: [],
    avatar: entry.avatar,
    about: undefined,
  };
};
