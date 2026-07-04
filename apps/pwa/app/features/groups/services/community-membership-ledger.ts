import type { GroupConversation } from "@/app/features/messaging/types";
import type { CommunityMembershipStatus } from "@dweb/core/community-projection-contracts";
import { getDefaultProfileId, getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getProfileRuntimeScope, getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { logAppEvent } from "@/app/shared/log-app-event";
import { enrichWorkspaceGroupConversation } from "./community-workspace-r1-policy";
import { deriveCommunityId, pickPreferredCommunityId } from "../utils/community-identity";
import { pickPreferredCommunityDisplayName } from "./community-display-name";
import { toGroupConversationId } from "../utils/group-conversation-id";
import { communityMembershipScopeMatches } from "./community-membership-scope-key";
import {
  validateLedgerEntry,
  assertValidLedgerEntry,
  validateLedgerEntries,
  needsMigration,
  CURRENT_LEDGER_VERSION,
  type ValidationResult,
} from "./community-ledger-validator";
import { migrateLedgerEntry } from "./community-ledger-migration";
import { messagingChatStateReadPort } from "@/app/features/messaging/services/messaging-chat-state-read-port";

const MEMBERSHIP_LEDGER_STORAGE_PREFIX = "obscur.group.membership_ledger.v1";
/** Pre-resolution scope used during fresh-device restore before profile rebind. */
const BOOTSTRAP_PROFILE_SCOPE = "bootstrap";
export const LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE = "Group key unavailable on this device";
export const COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT = "obscur:community-membership-ledger-updated";

/** Window + profile-bus payload for ledger snapshot changes (`profileId` on v1.5+ bus/window emits). */
export type CommunityMembershipLedgerUpdatedEventDetail = Readonly<{
  publicKeyHex: string;
  profileId?: string;
}>;
const ledgerLoadSignatureByScope = new Map<string, string>();
const ledgerMigrationInFlightByScope = new Set<string>();
export type { CommunityMembershipStatus } from "@dweb/core/community-projection-contracts";

/**
 * Community Membership Ledger Entry
 *
 * NOTE: Fields marked with (v2+) are required for data integrity and were
 * added in schema version 2. Legacy entries may not have these fields.
 *
 * For new entries, ALL fields should be populated using toCommunityMembershipLedgerEntryFromGroup()
 * which now includes proper member list preservation.
 */
export type CommunityMembershipLedgerEntry = Readonly<{
  // Core Identity (always required)
  groupId: string;

  // Membership State
  status: CommunityMembershipStatus;
  joinedAt?: number;

  // Group Metadata
  displayName?: string;
  avatarUrl?: string;

  // CRITICAL (v2+): Member Lists - Required for complete recovery
  // These fields prevent the "Private Group with 1 member" bug
  memberPubkeys?: ReadonlyArray<string>;
  adminPubkeys?: ReadonlyArray<string>;

  // Ledger Metadata (v2+): For migrations and data integrity
  ledgerVersion?: number;
  publicKeyHex?: string;
  createdAt?: number;
  updatedAt?: number;

  // Legacy fields (maintained for backward compatibility)
  communityId?: string;
  relayUrl?: string;
  updatedAtUnixMs?: number;
  lastEvidenceEventId?: string;
  avatar?: string;
}>;

/** Re-export validation types for convenience */
export type { ValidationResult } from "./community-ledger-validator";

const normalizeRelayUrl = (relayUrl: string | null | undefined): string => {
  const trimmed = (relayUrl ?? "").trim();
  return trimmed.length > 0 ? trimmed : "unknown";
};

const isCommunityMembershipStatus = (value: unknown): value is CommunityMembershipStatus => (
  value === "joined" || value === "left" || value === "expelled" ||
  value === "historical" || value === "invited" || value === "pending" || value === "unknown"
);

export const toCommunityMembershipLedgerKey = (
  params: Readonly<{ groupId: string; relayUrl?: string }>
): string | null => {
  const trimmedGroupId = params.groupId.trim();
  const trimmedRelayUrl = params.relayUrl?.trim();
  if (trimmedGroupId.length === 0 || !trimmedRelayUrl || trimmedRelayUrl.length === 0) {
    return null;
  }
  return `${trimmedGroupId}@@${normalizeRelayUrl(trimmedRelayUrl)}`;
};

const toLegacyStorageKey = (publicKeyHex: string): string => (
  `${MEMBERSHIP_LEDGER_STORAGE_PREFIX}.${publicKeyHex}`
);

const toStorageKey = (publicKeyHex: string, profileId?: string): string => (
  getScopedStorageKey(toLegacyStorageKey(publicKeyHex), profileId ?? getResolvedProfileId())
);

const mayWriteLegacyMembershipLedger = (profileId: string): boolean => (
  profileId === getDefaultProfileId() || profileId === BOOTSTRAP_PROFILE_SCOPE
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
  const memberPubkeys = Array.isArray(candidate.memberPubkeys)
    ? candidate.memberPubkeys
      .filter((pubkey): pubkey is string => typeof pubkey === "string" && pubkey.trim().length > 0)
      .map((pubkey) => pubkey.trim())
    : undefined;
  const adminPubkeys = Array.isArray(candidate.adminPubkeys)
    ? candidate.adminPubkeys
      .filter((pubkey): pubkey is string => typeof pubkey === "string" && pubkey.trim().length > 0)
      .map((pubkey) => pubkey.trim())
    : undefined;
  const ledgerVersion = Number.isFinite(candidate.ledgerVersion)
    ? Number(candidate.ledgerVersion)
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
    ...(memberPubkeys && memberPubkeys.length > 0 ? { memberPubkeys } : {}),
    ...(adminPubkeys && adminPubkeys.length > 0 ? { adminPubkeys } : {}),
    ...(ledgerVersion !== undefined ? { ledgerVersion } : {}),
    ...(typeof candidate.publicKeyHex === "string" && candidate.publicKeyHex.trim().length > 0
      ? { publicKeyHex: candidate.publicKeyHex.trim() }
      : {}),
    ...(Number.isFinite(candidate.createdAt) ? { createdAt: Number(candidate.createdAt) } : {}),
    ...(Number.isFinite(candidate.updatedAt) ? { updatedAt: Number(candidate.updatedAt) } : {}),
  };
};

const ACTIVE_MEMBERSHIP_LEDGER_STATUSES = new Set<CommunityMembershipStatus>(["joined", "pending"]);

const deriveFallbackLedgerDisplayName = (groupId: string): string => {
  const trimmed = groupId.trim();
  if (trimmed.length === 0) {
    return "Community";
  }
  return trimmed.length <= 12 ? trimmed : `Community ${trimmed.slice(0, 8)}`;
};

const TERMINAL_LEDGER_STATUSES = new Set<CommunityMembershipStatus>(["left", "expelled"]);

const isTerminalLedgerStatus = (status: CommunityMembershipStatus): boolean => (
  TERMINAL_LEDGER_STATUSES.has(status)
);

/** REL-001: terminal leave beats stale joined rows even when joined has a newer timestamp. */
const pickExplicitLedgerEntryByPrecedence = (
  a: CommunityMembershipLedgerEntry,
  b: CommunityMembershipLedgerEntry,
): CommunityMembershipLedgerEntry => {
  const aTerminal = isTerminalLedgerStatus(a.status);
  const bTerminal = isTerminalLedgerStatus(b.status);
  if (aTerminal && b.status === "joined") {
    return a;
  }
  if (bTerminal && a.status === "joined") {
    return b;
  }
  return (a.updatedAtUnixMs ?? 0) >= (b.updatedAtUnixMs ?? 0) ? a : b;
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
    if (!key) {
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, normalized);
      continue;
    }
    // M2: explicit user-intent statuses always beat historical reconstruction
    // regardless of timestamp. Only fall back to timestamp when both entries
    // carry the same class of authority.
    const normalizedIsExplicit = normalized.status !== "historical" && normalized.status !== "unknown";
    const existingIsExplicit = existing.status !== "historical" && existing.status !== "unknown";
    const newerByPrecedence = (normalizedIsExplicit && !existingIsExplicit)
      ? normalized
      : (!normalizedIsExplicit && existingIsExplicit)
        ? existing
        : pickExplicitLedgerEntryByPrecedence(normalized, existing);
    const newer = newerByPrecedence;
    const older = newer === normalized ? existing : normalized;
    // Merge memberPubkeys from both entries to avoid losing members
    const mergedMemberPubkeys = Array.from(new Set([
      ...(older.memberPubkeys ?? []),
      ...(newer.memberPubkeys ?? []),
    ]));
    // Merge adminPubkeys from both entries
    const mergedAdminPubkeys = Array.from(new Set([
      ...(older.adminPubkeys ?? []),
      ...(newer.adminPubkeys ?? []),
    ]));
    byKey.set(key, {
      ...older,
      ...newer,
      communityId: pickPreferredCommunityId(newer.communityId, older.communityId) ?? newer.communityId,
      displayName: newer.displayName ?? older.displayName,
      avatar: newer.avatar ?? older.avatar,
      lastEvidenceEventId: newer.lastEvidenceEventId ?? older.lastEvidenceEventId,
      memberPubkeys: mergedMemberPubkeys.length > 0 ? mergedMemberPubkeys : undefined,
      adminPubkeys: mergedAdminPubkeys.length > 0 ? mergedAdminPubkeys : undefined,
    });
  }
  return Array.from(byKey.values()).sort((left, right) => (right.updatedAtUnixMs ?? 0) - (left.updatedAtUnixMs ?? 0));
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

const TERMINAL_MEMBERSHIP_LEDGER_STATUSES = new Set<CommunityMembershipStatus>(["left", "expelled"]);

export const isTerminalCommunityMembershipLedgerEntry = (
  entry: CommunityMembershipLedgerEntry,
): boolean => TERMINAL_MEMBERSHIP_LEDGER_STATUSES.has(entry.status);

export const summarizeCommunityMembershipLedger = (
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): Readonly<{ joinedCount: number; archivedCount: number; totalCount: number }> => {
  let joinedCount = 0;
  let archivedCount = 0;
  for (const entry of entries) {
    if (entry.status === "joined") {
      joinedCount += 1;
    } else if (isTerminalCommunityMembershipLedgerEntry(entry)) {
      archivedCount += 1;
    }
  }
  return {
    joinedCount,
    archivedCount,
    totalCount: entries.length,
  };
};

export const removeCommunityMembershipLedgerScopes = (
  publicKeyHex: string,
  scopes: ReadonlyArray<Readonly<{ groupId: string; relayUrl?: string }>>,
  options?: Readonly<{ profileId?: string }>,
): number => {
  if (scopes.length === 0) {
    return 0;
  }
  const current = readCommunityMembershipLedger(publicKeyHex, options);
  const next = current.filter((entry) => !scopes.some((scope) => (
    communityMembershipScopeMatches(
      { groupId: entry.groupId, relayUrl: entry.relayUrl ?? "" },
      { groupId: scope.groupId, relayUrl: scope.relayUrl ?? "" },
    )
  )));
  if (next.length === current.length) {
    return 0;
  }
  persistCommunityMembershipLedger(publicKeyHex, next, options);
  return current.length - next.length;
};

const loadPersistedGroupsForLedgerMigration = (
  publicKeyHex: string,
  profileId: string,
): ReadonlyArray<{
  groupId: string;
  displayName?: string;
  memberPubkeys?: readonly string[];
  adminPubkeys?: readonly string[];
}> => {
  const chatState = messagingChatStateReadPort.load(publicKeyHex, { profileId });
  return (chatState?.createdGroups ?? [])
    .map((group) => ({
      groupId: typeof group.groupId === "string" ? group.groupId.trim() : "",
      displayName: group.displayName,
      memberPubkeys: group.memberPubkeys,
      adminPubkeys: group.adminPubkeys,
    }))
    .filter((group) => group.groupId.length > 0);
};

const applyLedgerVersionMigrationOnLoad = (
  publicKeyHex: string,
  profileId: string,
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const pendingMigrationCount = entries.filter((entry) => needsMigration(entry)).length;
  if (pendingMigrationCount === 0) {
    return entries;
  }

  const scopeKey = `${publicKeyHex}::${profileId}`;
  if (ledgerMigrationInFlightByScope.has(scopeKey)) {
    return entries;
  }

  const now = Date.now();
  const persistedGroups = [...loadPersistedGroupsForLedgerMigration(publicKeyHex, profileId)];
  const migrationContext = {
    publicKeyHex,
    persistedGroups,
    now,
  };

  const migratedEntries = entries.map((entry) => (
    needsMigration(entry) ? migrateLedgerEntry(entry, migrationContext) : entry
  ));

  const migrationChanged = migratedEntries.some((entry, index) => (
    JSON.stringify(entry) !== JSON.stringify(entries[index])
  ));

  if (!migrationChanged) {
    return migratedEntries;
  }

  ledgerMigrationInFlightByScope.add(scopeKey);
  try {
    persistCommunityMembershipLedger(publicKeyHex, migratedEntries, {
      profileId,
      replace: true,
    });
  } finally {
    ledgerMigrationInFlightByScope.delete(scopeKey);
  }

  logAppEvent({
    name: "groups.ledger_migration_applied",
    level: "info",
    scope: { feature: "groups", action: "ledger_load" },
    context: {
      publicKeySuffix: toPublicKeySuffix(publicKeyHex),
      profileId,
      pendingMigrationCount,
      migratedEntryCount: migratedEntries.length,
    },
  });

  return migratedEntries;
};

const repairIncompleteJoinedLedgerEntriesOnLoad = (
  publicKeyHex: string,
  profileId: string,
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const persistedGroups = loadPersistedGroupsForLedgerMigration(publicKeyHex, profileId);
  let changed = false;

  const repaired = entries.map((entry) => {
    if (!ACTIVE_MEMBERSHIP_LEDGER_STATUSES.has(entry.status)) {
      return entry;
    }

    const groupId = entry.groupId?.trim() ?? "";
    const persistedGroup = persistedGroups.find((group) => group.groupId === groupId);
    const nextPublicKeyHex = entry.publicKeyHex?.trim() || publicKeyHex;
    const nextMemberPubkeys = (
      entry.memberPubkeys && entry.memberPubkeys.length > 0
        ? entry.memberPubkeys
        : persistedGroup?.memberPubkeys && persistedGroup.memberPubkeys.length > 0
          ? persistedGroup.memberPubkeys
          : [nextPublicKeyHex]
    );
    const nextAdminPubkeys = (
      entry.adminPubkeys && entry.adminPubkeys.length > 0
        ? entry.adminPubkeys
        : persistedGroup?.adminPubkeys && persistedGroup.adminPubkeys.length > 0
          ? persistedGroup.adminPubkeys
          : [nextPublicKeyHex]
    );
    const nextDisplayName = entry.displayName?.trim()
      || persistedGroup?.displayName?.trim()
      || deriveFallbackLedgerDisplayName(groupId);
    const now = Date.now();

    const patched: CommunityMembershipLedgerEntry = {
      ...entry,
      publicKeyHex: nextPublicKeyHex,
      memberPubkeys: [...nextMemberPubkeys],
      adminPubkeys: [...nextAdminPubkeys],
      displayName: nextDisplayName,
      ledgerVersion: entry.ledgerVersion ?? CURRENT_LEDGER_VERSION,
      createdAt: entry.createdAt ?? entry.updatedAtUnixMs ?? now,
      updatedAt: now,
      updatedAtUnixMs: entry.updatedAtUnixMs ?? now,
    };

    if (JSON.stringify(patched) !== JSON.stringify(entry)) {
      changed = true;
    }
    return patched;
  });

  if (!changed) {
    return entries;
  }

  const scopeKey = `${publicKeyHex}::${profileId}`;
  ledgerMigrationInFlightByScope.add(scopeKey);
  try {
    persistCommunityMembershipLedger(publicKeyHex, repaired, {
      profileId,
      replace: true,
    });
  } finally {
    ledgerMigrationInFlightByScope.delete(scopeKey);
  }

  logAppEvent({
    name: "groups.ledger_field_repair_applied",
    level: "info",
    scope: { feature: "groups", action: "ledger_load" },
    context: {
      publicKeySuffix: toPublicKeySuffix(publicKeyHex),
      profileId,
      repairedEntryCount: repaired.length,
    },
  });

  return repaired;
};

const readStoredCommunityMembershipLedger = (
  publicKeyHex: string,
  profileId: string,
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const scopedRaw = window.localStorage.getItem(toStorageKey(publicKeyHex, profileId));
    const legacyRaw = profileId === getDefaultProfileId()
      ? window.localStorage.getItem(toLegacyStorageKey(publicKeyHex))
      : null;

    const scopedEntries = scopedRaw
      ? parseCommunityMembershipLedgerSnapshot(JSON.parse(scopedRaw))
      : [];
    const legacyEntries = legacyRaw
      ? parseCommunityMembershipLedgerSnapshot(JSON.parse(legacyRaw))
      : [];

    return mergeCommunityMembershipLedgerEntries(scopedEntries, legacyEntries);
  } catch {
    return [];
  }
};

const readCommunityMembershipLedger = (
  publicKeyHex: string,
  options?: Readonly<{ profileId?: string }>
): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  if (typeof window === "undefined") {
    return [];
  }
  const profileId = options?.profileId ?? getResolvedProfileId();
  try {
    const mergedEntries = readStoredCommunityMembershipLedger(publicKeyHex, profileId);

    if (mergedEntries.length === 0) {
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
    const scopeKey = `${publicKeyHex}::${profileId}`;
    if (ledgerMigrationInFlightByScope.has(scopeKey)) {
      return mergedEntries;
    }
    const entriesAfterMigration = applyLedgerVersionMigrationOnLoad(publicKeyHex, profileId, mergedEntries);
    const entriesAfterRepair = ledgerMigrationInFlightByScope.has(scopeKey)
      ? entriesAfterMigration
      : repairIncompleteJoinedLedgerEntriesOnLoad(publicKeyHex, profileId, entriesAfterMigration);

    const needsMigrationCount = entriesAfterRepair.filter((entry) => needsMigration(entry)).length;
    if (needsMigrationCount > 0) {
      logAppEvent({
        name: "groups.ledger_migration_needed",
        level: "info",
        scope: { feature: "groups", action: "ledger_load" },
        context: {
          publicKeySuffix: toPublicKeySuffix(publicKeyHex),
          profileId,
          needsMigrationCount,
          totalEntries: mergedEntries.length,
        },
      });
    }

    // Validation: Check all entries for issues
    const validationResults = validateLedgerEntries(entriesAfterRepair, { allowLegacy: true });
    if (validationResults.invalid > 0) {
      logAppEvent({
        name: "groups.ledger_validation_issues",
        level: "warn",
        scope: { feature: "groups", action: "ledger_load" },
        context: {
          publicKeySuffix: toPublicKeySuffix(publicKeyHex),
          profileId,
          invalidEntries: validationResults.invalid,
          totalEntries: validationResults.total,
          sampleErrors: validationResults.errors.slice(0, 3).join('; '),
        },
      });
    }

    const signature = `profile:${profileId}|scoped:${mergedEntries.length}|legacy:0|merged:${entriesAfterRepair.length}|needsMigration:${needsMigrationCount}|invalid:${validationResults.invalid}`;
    if (ledgerLoadSignatureByScope.get(scopeKey) !== signature) {
      ledgerLoadSignatureByScope.set(scopeKey, signature);
      logAppEvent({
        name: "groups.membership_ledger_load",
        level: "info",
        scope: { feature: "groups", action: "membership_ledger" },
        context: {
          publicKeySuffix: toPublicKeySuffix(publicKeyHex),
          profileId,
          scopedEntryCount: mergedEntries.length,
          legacyEntryCount: 0,
          mergedEntryCount: entriesAfterRepair.length,
          needsMigrationCount,
          invalidEntries: validationResults.invalid,
        },
      });
    }
    return entriesAfterRepair;
  } catch {
    return [];
  }
};

export const loadCommunityMembershipLedger = (
  publicKeyHex: string,
  options?: Readonly<{ profileId?: string }>
): ReadonlyArray<CommunityMembershipLedgerEntry> => readCommunityMembershipLedger(publicKeyHex, options);

const persistCommunityMembershipLedger = (
  publicKeyHex: string,
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
  options?: Readonly<{ profileId?: string; replace?: boolean }>
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    // AB-05: merge incoming entries with whatever is already stored so that
    // a newer stored "left" entry cannot be silently overwritten by an older
    // incoming "joined" entry. dedupeCommunityMembershipLedger keeps the
    // entry with the higher updatedAtUnixMs when two entries share the same
    // ledger key, which is the correct timestamp-precedence behaviour.
    const activeProfileId = options?.profileId ?? getResolvedProfileId();
    const existingStored = readStoredCommunityMembershipLedger(publicKeyHex, activeProfileId);
    const normalizedEntries = options?.replace
      ? dedupeCommunityMembershipLedger([...entries])
      : dedupeCommunityMembershipLedger([...existingStored, ...entries]);
    const serialized = JSON.stringify(normalizedEntries);
    const storageKey = toStorageKey(publicKeyHex, activeProfileId);
    const legacyStorageKey = toLegacyStorageKey(publicKeyHex);
    const existingScoped = window.localStorage.getItem(storageKey);
    const existingLegacy = window.localStorage.getItem(legacyStorageKey);
    const isSnapshotUnchanged = existingScoped === serialized || existingLegacy === serialized;

    if (existingScoped !== serialized) {
      window.localStorage.setItem(storageKey, serialized);
    }
    // AB-08: only the default profile (or pre-rebind bootstrap restore) may write
    // the legacy (unscoped) key. Named profiles must never seed or overwrite legacy.
    if (mayWriteLegacyMembershipLedger(activeProfileId) && existingLegacy !== serialized) {
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
        profileId: activeProfileId,
        savedEntryCount: normalizedEntries.length,
      },
    });
    const ledgerUpdatedDetail: CommunityMembershipLedgerUpdatedEventDetail = {
      publicKeyHex,
      profileId: activeProfileId,
    };
    const runtimeScope = getProfileRuntimeScope();
    if (runtimeScope?.bus && runtimeScope.profileId === activeProfileId) {
      runtimeScope.bus.publish({
        type: "community-membership-ledger-updated",
        detail: ledgerUpdatedDetail,
      });
    }
    emitAccountSyncMutation("community_membership_changed");
  } catch {
    return;
  }
};

export const saveCommunityMembershipLedger = (
  publicKeyHex: string,
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
  options?: Readonly<{ profileId?: string }>
): void => {
  persistCommunityMembershipLedger(publicKeyHex, entries, options);
};

export const replaceCommunityMembershipLedger = (
  publicKeyHex: string,
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
  options?: Readonly<{ profileId?: string }>
): void => {
  persistCommunityMembershipLedger(publicKeyHex, entries, {
    ...options,
    replace: true,
  });
};

export const upsertCommunityMembershipLedgerEntry = (
  publicKeyHex: string,
  entry: CommunityMembershipLedgerEntry,
  options?: Readonly<{ profileId?: string }>
): void => {
  // Validate entry before saving (warn but don't block for backward compatibility)
  const validation = validateLedgerEntry(entry, { context: 'upsert', allowLegacy: true });
  if (!validation.valid) {
    console.warn('[CommunityLedger] Validation failed for entry:', entry.groupId, validation.errors);
    logAppEvent({
      name: "groups.ledger_entry_invalid",
      level: "warn",
      scope: { feature: "groups", action: "ledger_upsert" },
      context: {
        groupId: entry.groupId,
        errors: validation.errors.join('; '),
        warnings: validation.warnings.join('; '),
      },
    });
  }

  const current = readCommunityMembershipLedger(publicKeyHex, options);
  const next = mergeCommunityMembershipLedgerEntries(current, [entry]);
  const activeProfileId = options?.profileId ?? getResolvedProfileId();
  const ledgerKey = toCommunityMembershipLedgerKey({
    groupId: entry.groupId,
    relayUrl: entry.relayUrl,
  });
  const rowForKey = (
    rows: ReadonlyArray<CommunityMembershipLedgerEntry>,
    key: string,
  ): CommunityMembershipLedgerEntry | undefined => (
    rows.find((row) => toCommunityMembershipLedgerKey({
      groupId: row.groupId,
      relayUrl: row.relayUrl,
    }) === key)
  );
  const mutationApplied = !ledgerKey
    ? current.length !== next.length
    : JSON.stringify(rowForKey(current, ledgerKey)) !== JSON.stringify(rowForKey(next, ledgerKey));

  if (mutationApplied) {
    const resolvedRow = ledgerKey ? rowForKey(next, ledgerKey) : undefined;
    logAppEvent({
      name: "groups.membership_ledger_mutation_applied",
      level: "info",
      scope: { feature: "groups", action: "membership_ledger" },
      context: {
        publicKeySuffix: toPublicKeySuffix(publicKeyHex),
        profileId: activeProfileId,
        ledgerKey: ledgerKey ?? null,
        status: resolvedRow?.status ?? entry.status,
        updatedAtUnixMs: resolvedRow?.updatedAtUnixMs ?? entry.updatedAtUnixMs ?? null,
        lastEvidenceEventId: resolvedRow?.lastEvidenceEventId ?? entry.lastEvidenceEventId ?? null,
        priorEntryCount: current.length,
        nextEntryCount: next.length,
      },
    });
  }

  saveCommunityMembershipLedger(publicKeyHex, next, options);
};

const setCommunityMembershipStatus = (
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
  }>,
  options?: Readonly<{ profileId?: string }>
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
  }, options);
};

export const communityMembershipLedgerInternals = {
  setCommunityMembershipStatus,
} as const;

export const toCommunityMembershipLedgerEntryFromGroup = (
  group: GroupConversation,
  options?: Readonly<{
    status?: CommunityMembershipStatus;
    updatedAtUnixMs?: number;
    lastEvidenceEventId?: string;
  }>
): CommunityMembershipLedgerEntry => {
  const now = Date.now();
  const entry: CommunityMembershipLedgerEntry = {
    communityId: deriveCommunityId({
      existingCommunityId: group.communityId,
      groupId: group.groupId,
      relayUrl: group.relayUrl,
      genesisEventId: group.genesisEventId,
      creatorPubkey: group.creatorPubkey,
    }),
    groupId: group.groupId,
    publicKeyHex: group.creatorPubkey ?? '',
    relayUrl: group.relayUrl,
    status: options?.status ?? "joined",
    updatedAtUnixMs: options?.updatedAtUnixMs ?? now,
    lastEvidenceEventId: options?.lastEvidenceEventId,
    displayName: group.displayName,
    avatar: group.avatar,
    memberPubkeys: group.memberPubkeys ?? [],
    adminPubkeys: group.adminPubkeys ?? [],
    ledgerVersion: CURRENT_LEDGER_VERSION,
    createdAt: now,
    updatedAt: now,
  };

  // Validate the new entry (log warnings but don't block)
  const validation = validateLedgerEntry(entry, { context: 'fromGroup' });
  if (!validation.valid) {
    console.warn('[CommunityLedger] New entry validation failed:', validation.errors);
  }

  return entry;
};

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
  const entryMemberPubkeys = Array.from(new Set((entry.memberPubkeys ?? []).map((pubkey) => pubkey.trim()).filter((pubkey) => pubkey.length > 0)));
  const fallbackMemberPubkeys = Array.from(new Set((options?.fallbackMemberPubkeys ?? []).map((pubkey) => pubkey.trim()).filter((pubkey) => pubkey.length > 0)));
  // MEM-003: union ledger + fallback seeds — thin self-only ledger rows must not hide invite peers.
  const mergedMemberPubkeys = Array.from(new Set([
    ...entryMemberPubkeys,
    ...fallbackMemberPubkeys,
  ]));
  const memberCount = Math.max(mergedMemberPubkeys.length, 1);
  const displayName = pickPreferredCommunityDisplayName(
    entry.displayName,
    options?.fallbackDisplayName,
    { groupId: entry.groupId, communityId, conversationId: id },
  );
  return enrichWorkspaceGroupConversation({
    kind: "group",
    id,
    communityId,
    groupId: entry.groupId,
    relayUrl: entry.relayUrl ?? "",
    displayName,
    memberPubkeys: mergedMemberPubkeys,
    lastMessage: LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE,
    unreadCount: 0,
    lastMessageTime: new Date(entry.updatedAtUnixMs ?? entry.updatedAt ?? Date.now()),
    access: "invite-only",
    memberCount,
    adminPubkeys: Array.from(new Set((entry.adminPubkeys ?? []).map((pubkey) => pubkey.trim()).filter((pubkey) => pubkey.length > 0))),
    avatar: entry.avatar,
    about: undefined,
  });
};
