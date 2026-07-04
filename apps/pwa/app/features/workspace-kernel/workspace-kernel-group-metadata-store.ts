import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { messagingChatStateReadPort } from "@/app/features/messaging/services/messaging-chat-state-read-port";
import {
  fromPersistedGroupConversation,
  toPersistedGroupConversation,
} from "@/app/features/messaging/utils/persistence";
import type { PersistedGroupConversation } from "@/app/features/messaging/types";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { isGroupTombstoned } from "@/app/features/groups/services/group-tombstone-store";
import {
  loadCommunityMembershipLedger,
  toGroupConversationFromMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import { enrichWorkspaceGroupConversation } from "@/app/features/groups/services/community-workspace-r1-policy";
import { hasTerminalLedgerScopeEvidence } from "./workspace-kernel-membership-scope";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

const normalizeWorkspaceGroupConversation = (
  group: GroupConversation,
): GroupConversation => enrichWorkspaceGroupConversation(group);

const STORAGE_PREFIX = "obscur.workspace-kernel.group_metadata.v1";

const toStorageKey = (publicKeyHex: PublicKeyHex, profileId: string): string => (
  getScopedStorageKey(`${STORAGE_PREFIX}.${publicKeyHex}`, profileId)
);

const parsePersistedGroups = (raw: string): ReadonlyArray<PersistedGroupConversation> => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is PersistedGroupConversation => (
      !!entry
      && typeof entry === "object"
      && typeof (entry as PersistedGroupConversation).id === "string"
      && typeof (entry as PersistedGroupConversation).groupId === "string"
    ));
  } catch {
    return [];
  }
};

const readDedicatedPersistedGroups = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
): ReadonlyArray<PersistedGroupConversation> => {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(toStorageKey(publicKeyHex, profileId));
  if (!raw) {
    return [];
  }
  return parsePersistedGroups(raw);
};

const writeDedicatedPersistedGroups = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  groups: ReadonlyArray<PersistedGroupConversation>,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(toStorageKey(publicKeyHex, profileId), JSON.stringify(groups));
};

const migrateFromChatStateIfNeeded = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
): ReadonlyArray<PersistedGroupConversation> => {
  const persisted = messagingChatStateReadPort.load(publicKeyHex, { profileId });
  const ledger = loadCommunityMembershipLedger(publicKeyHex, { profileId });
  const migrated = (persisted?.createdGroups ?? []).filter((group) => {
    const groupId = typeof group.groupId === "string" ? group.groupId.trim() : "";
    const relayUrl = typeof group.relayUrl === "string" ? group.relayUrl.trim() : "";
    if (!groupId || !relayUrl) {
      return false;
    }
    if (isGroupTombstoned(publicKeyHex, { groupId, relayUrl }, { profileId })) {
      return false;
    }
    if (hasTerminalLedgerScopeEvidence(ledger, { groupId, relayUrl })) {
      return false;
    }
    return true;
  });
  if (migrated.length > 0) {
    writeDedicatedPersistedGroups(publicKeyHex, profileId, migrated);
  }
  return migrated;
};

const mergeJoinedLedgerIntoGroups = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  groups: ReadonlyArray<GroupConversation>,
): ReadonlyArray<GroupConversation> => {
  if (!isWorkspaceKernelAuthority()) {
    return groups;
  }
  const mergedById = new Map(groups.map((group) => [group.id, group]));
  const ledger = loadCommunityMembershipLedger(publicKeyHex, { profileId });
  for (const entry of ledger) {
    if (entry.status !== "joined") {
      continue;
    }
    const recovered = toGroupConversationFromMembershipLedgerEntry(entry);
    const groupId = recovered.groupId.trim();
    const relayUrl = recovered.relayUrl.trim();
    if (isGroupTombstoned(publicKeyHex, { groupId, relayUrl }, { profileId })) {
      continue;
    }
    if (hasTerminalLedgerScopeEvidence(ledger, { groupId, relayUrl })) {
      continue;
    }
    const existing = mergedById.get(recovered.id);
    mergedById.set(
      recovered.id,
      existing
        ? { ...existing, ...recovered, displayName: existing.displayName || recovered.displayName }
        : recovered,
    );
  }
  return Array.from(mergedById.values());
};

export const loadWorkspaceGroupMetadataRecords = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
): ReadonlyArray<GroupConversation> => {
  let persisted = readDedicatedPersistedGroups(publicKeyHex, profileId);
  if (persisted.length === 0) {
    persisted = migrateFromChatStateIfNeeded(publicKeyHex, profileId);
  }

  const hydrated = persisted
    .map((row) => fromPersistedGroupConversation(row))
    .filter((group) => !isGroupTombstoned(publicKeyHex, {
      groupId: group.groupId,
      relayUrl: group.relayUrl,
    }, { profileId }));

  return hydrated;
};

/** Synchronous durable write — metadata rows only; ledger merge is display-time via list-port. */
export const saveWorkspaceGroupMetadataRecords = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  groups: ReadonlyArray<GroupConversation>,
): void => {
  writeDedicatedPersistedGroups(
    publicKeyHex,
    profileId,
    groups.map((group) => toPersistedGroupConversation(group)),
  );
};

/** Display-only merge of joined ledger rows (never persisted). */
export const mergeJoinedLedgerGroupsForDisplay = mergeJoinedLedgerIntoGroups;

export const removeWorkspaceGroupMetadataRecord = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  conversationId: string,
): void => {
  const current = readDedicatedPersistedGroups(publicKeyHex, profileId)
    .map((row) => fromPersistedGroupConversation(row));
  saveWorkspaceGroupMetadataRecords(
    publicKeyHex,
    profileId,
    current.filter((group) => group.id !== conversationId),
  );
};

export const upsertWorkspaceGroupMetadataRecord = (
  publicKeyHex: PublicKeyHex,
  profileId: string,
  group: GroupConversation,
): ReadonlyArray<GroupConversation> => {
  const current = loadWorkspaceGroupMetadataRecords(publicKeyHex, profileId);
  const existingIndex = current.findIndex((row) => row.id === group.id);
  const normalizedGroup = normalizeWorkspaceGroupConversation(group);
  const next = existingIndex >= 0
    ? current.map((row, index) => (index === existingIndex ? { ...row, ...normalizedGroup } : row))
    : [...current, normalizedGroup];
  saveWorkspaceGroupMetadataRecords(publicKeyHex, profileId, next);
  return next;
};
