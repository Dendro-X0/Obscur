"use client";

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import type { IdentityRecord } from "@dweb/core/identity-record";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { messagePersistenceService } from "@/app/features/messaging/services/message-persistence-service";
import {
  loadMessageDeleteTombstoneEntries,
  normalizeMessageDeleteTombstoneEntries,
  replaceMessageDeleteTombstones,
} from "@/app/features/messaging/services/message-delete-tombstone-store";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { requestFlowEvidenceStoreInternals } from "@/app/features/messaging/services/request-flow-evidence-store";
import { syncCheckpointInternals } from "@/app/features/messaging/lib/sync-checkpoints";
import { PrivacySettingsService, defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { contactRequestOutboxInternals } from "@/app/features/search/hooks/use-contact-request-outbox";
import type { ContactRequestRecord } from "@/app/features/search/types/discovery";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { getActiveProfileIdSafe, getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { publishViaRelayCore, type RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import {
  loadCommunityMembershipLedger,
  mergeCommunityMembershipLedgerEntries,
  parseCommunityMembershipLedgerSnapshot,
  saveCommunityMembershipLedger,
  toCommunityMembershipLedgerKey,
  type CommunityMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import {
  reconstructCommunityMembershipFromChatState,
  reconstructRoomKeysFromChatState,
  supplementMembershipLedgerEntries,
} from "@/app/features/groups/services/community-membership-reconstruction";
import {
  DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG,
  getLocalMediaStorageConfig,
  saveLocalMediaStorageConfig,
} from "@/app/features/vault/services/local-media-store";
import { accountSyncStatusStore } from "./account-sync-status-store";
import { buildCanonicalBackupImportEvents } from "./account-event-bootstrap-service";
import {
  resolveCanonicalBackupRestoreOwnerSelection,
} from "./restore-import-contracts";
import {
  emitBackupRestoreSelectionDiagnostics,
  maybeEmitBackupRestoreProfileScopeMismatch,
  emitBackupRestoreOwnerSelection,
  maybeEmitBackupRestoreHistoryRegression,
  toPrefixedChatStateDiagnosticsContext,
} from "./restore-diagnostics";
import {
  emitBackupPublishOrdering,
  emitIdentityUnlockConflictPreservedLocal,
  emitPortableBundleExport,
  emitPortableBundleImport,
} from "./restore-merge-diagnostics";
import {
  emitMergeCompletionDiagnostics,
  emitApplyCompletionDiagnostics,
  evaluatePublishConvergenceOutcome,
  orchestrateRestoreMerge,
} from "./restore-merge-module";
import {
  maybeConvergeBackupPayloadBeforePublish,
  mergeBackupPayloadForPublishConvergence,
  hasPortablePrivateStateEvidence,
  buildBackupEnvelope,
  buildBackupUnsignedEvent,
  mapBackupDeliveryStatus,
  isBackupPublishSuccessful,
} from "./restore-merge-policy";
import {
  getPersistedGroupMessageCount,
  getPersistedMessageCount,
  hasReplayableChatHistory,
  mergeChatState,
  mergeMessageDeleteTombstones,
  mergePersistedGroupMessages,
  mergePersistedMessages,
  sanitizePersistedChatStateMessagesByDeleteContract,
  toMessageDeleteTombstoneIdSet,
  uniqueStrings,
} from "./restore-merge-chat-state";
import { applyNonV1RestoreMaterialization } from "./restore-materialization";
import { fetchLatestEventFromRelayUrls } from "./direct-relay-query";
import { getStoredIdentity } from "@/app/features/auth/utils/get-stored-identity";
import { saveStoredIdentity } from "@/app/features/auth/utils/save-stored-identity";
import type { AccountEvent } from "../account-event-contracts";
import type {
  AccountBackupFetchResult,
  ContactRequestOutboxSnapshot,
  EncryptedAccountBackupEnvelope,
  EncryptedAccountBackupPayload,
  IdentityUnlockSnapshot,
  MessageDeleteTombstoneSnapshotEntry,
  PortableAccountBundle,
  RelayListSnapshot,
  RequestFlowEvidenceStateSnapshot,
  RoomKeySnapshot,
  StoredPeerTrustSnapshot,
  SyncCheckpointSnapshot,
  UiSettingsSnapshot,
} from "../account-sync-contracts";
import { ACCOUNT_BACKUP_D_TAG, ACCOUNT_BACKUP_EVENT_KIND } from "../account-sync-contracts";
import {
  hydrateChatStateFromIndexedMessages,
  summarizePersistedChatStateMessages,
  toPersistedMessageFromIndexedRecord,
  toPersistedGroupMessageFromIndexedRecord,
} from "./restore-hydrate-indexed-messages";

const BACKUP_FETCH_TIMEOUT_MS = 4_000;
const RECOVERY_SNAPSHOT_STORAGE_PREFIX = "obscur.account_sync.recovery_snapshot.v1";
const CANONICAL_BACKUP_IMPORT_IDEMPOTENCY_PREFIX = "backup_restore_v1";
const PORTABLE_ACCOUNT_BUNDLE_FORMAT: PortableAccountBundle["format"] = "obscur.portable_account_bundle.v1";
const PORTABLE_BUNDLE_IMPORT_IDEMPOTENCY_PREFIX = "portable_bundle_import_v1";
const ACCOUNT_BACKUP_CREATED_AT_MS_TAG = "obscur_backup_created_at_ms";
const THEME_STORAGE_KEY = "dweb.nostr.pwa.ui.theme";
const ACCESSIBILITY_STORAGE_KEY = "dweb.nostr.pwa.ui.accessibility.v1";
const DEFAULT_THEME_PREFERENCE: UiSettingsSnapshot["themePreference"] = "system";
const DEFAULT_ACCESSIBILITY_PREFERENCES: UiSettingsSnapshot["accessibilityPreferences"] = {
  textScale: 100,
  reducedMotion: false,
  contrastAssist: false,
};
const PASSWORDLESS_NATIVE_ONLY_SENTINEL = "__obscur_native_only__";
const lastBackupEventCreatedAtByPublicKey = new Map<PublicKeyHex, number>();

const getBackupRestoreErrorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("OperationError")) {
    return "Encrypted account backup could not be decrypted with this key.";
  }
  return raw;
};

type RelayPoolWithSubscribe = RelayPoolLike & Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

type CanonicalBackupEventAppender = (params: Readonly<{
  profileId: string;
  accountPublicKeyHex: PublicKeyHex;
  events: ReadonlyArray<AccountEvent>;
}>) => Promise<void>;

const isIdentityUnlockSnapshot = (value: unknown): value is IdentityUnlockSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<IdentityUnlockSnapshot>;
  if (typeof candidate.encryptedPrivateKey !== "string" || candidate.encryptedPrivateKey.trim().length === 0) {
    return false;
  }
  if (typeof candidate.username !== "undefined" && typeof candidate.username !== "string") {
    return false;
  }
  return true;
};

const isPasswordlessIdentityUnlock = (
  value: IdentityUnlockSnapshot | undefined | null
): boolean => value?.encryptedPrivateKey === PASSWORDLESS_NATIVE_ONLY_SENTINEL;

const mergeIdentityUnlock = (
  current: IdentityUnlockSnapshot | undefined,
  incoming: IdentityUnlockSnapshot | undefined,
): IdentityUnlockSnapshot | undefined => {
  if (!current) {
    return incoming;
  }
  if (!incoming) {
    return current;
  }
  if (isPasswordlessIdentityUnlock(current) && !isPasswordlessIdentityUnlock(incoming)) {
    return {
      encryptedPrivateKey: incoming.encryptedPrivateKey,
      username: incoming.username ?? current.username,
    };
  }
  if (!isPasswordlessIdentityUnlock(current) && isPasswordlessIdentityUnlock(incoming)) {
    return current;
  }
  if (current.encryptedPrivateKey !== incoming.encryptedPrivateKey) {
    // Preserve local unlock material on already-provisioned devices so
    // restore cannot silently invalidate a known-good local credential.
    emitIdentityUnlockConflictPreservedLocal({
      localUsernamePresent: typeof current.username === "string" && current.username.trim().length > 0,
      incomingUsernamePresent: typeof incoming.username === "string" && incoming.username.trim().length > 0,
    });
    return {
      encryptedPrivateKey: current.encryptedPrivateKey,
      username: current.username ?? incoming.username,
    };
  }
  return {
    encryptedPrivateKey: current.encryptedPrivateKey,
    username: current.username ?? incoming.username,
  };
};

const getRecoverySnapshotStorageKey = (publicKeyHex: PublicKeyHex): string => (
  `${RECOVERY_SNAPSHOT_STORAGE_PREFIX}.${publicKeyHex}`
);

const getCandidateRelayUrls = (pool: RelayPoolWithSubscribe): ReadonlyArray<string> => {
  return Array.from(new Set([
    ...pool.connections.map((connection) => connection.url),
    ...relayListInternals.DEFAULT_RELAYS.filter((relay) => relay.enabled).map((relay) => relay.url),
  ]));
};

const parseBackupCreatedAtMsTag = (event: NostrEvent): number | null => {
  for (const tag of event.tags) {
    if (tag[0] !== ACCOUNT_BACKUP_CREATED_AT_MS_TAG) {
      continue;
    }
    const parsed = Number(tag[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const compareBackupEvents = (left: NostrEvent, right: NostrEvent): number => {
  const leftCreatedAtMs = parseBackupCreatedAtMsTag(left) ?? (left.created_at * 1000);
  const rightCreatedAtMs = parseBackupCreatedAtMsTag(right) ?? (right.created_at * 1000);
  if (leftCreatedAtMs !== rightCreatedAtMs) {
    return leftCreatedAtMs - rightCreatedAtMs;
  }
  if (left.created_at !== right.created_at) {
    return left.created_at - right.created_at;
  }
  return left.id.localeCompare(right.id);
};

type BackupEventCreatedAtReservation = Readonly<{
  candidateUnixSeconds: number;
  lastUsedUnixSeconds: number;
  createdAtUnixSeconds: number;
  monotonicBumpApplied: boolean;
}>;

const reserveBackupEventCreatedAtUnixSeconds = (
  publicKeyHex: PublicKeyHex,
  backupPayloadCreatedAtUnixMs: number,
): BackupEventCreatedAtReservation => {
  const candidate = Math.floor(backupPayloadCreatedAtUnixMs / 1000);
  const lastUsed = lastBackupEventCreatedAtByPublicKey.get(publicKeyHex) ?? 0;
  const next = candidate <= lastUsed ? (lastUsed + 1) : candidate;
  lastBackupEventCreatedAtByPublicKey.set(publicKeyHex, next);
  return {
    candidateUnixSeconds: candidate,
    lastUsedUnixSeconds: lastUsed,
    createdAtUnixSeconds: next,
    monotonicBumpApplied: candidate <= lastUsed,
  };
};

const nextBackupEventCreatedAtUnixSeconds = (
  publicKeyHex: PublicKeyHex,
  backupPayloadCreatedAtUnixMs: number,
): number => {
  return reserveBackupEventCreatedAtUnixSeconds(
    publicKeyHex,
    backupPayloadCreatedAtUnixMs,
  ).createdAtUnixSeconds;
};


const normalizeRoomKeySnapshot = (value: unknown): RoomKeySnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<RoomKeySnapshot>;
  const groupId = typeof candidate.groupId === "string" ? candidate.groupId.trim() : "";
  const roomKeyHex = typeof candidate.roomKeyHex === "string" ? candidate.roomKeyHex.trim() : "";
  if (!groupId || !roomKeyHex) {
    return null;
  }
  const previousKeys = Array.isArray(candidate.previousKeys)
    ? uniqueStrings(
      candidate.previousKeys
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && entry !== roomKeyHex),
    )
    : [];
  return {
    groupId,
    roomKeyHex,
    createdAt: Number.isFinite(candidate.createdAt) && (candidate.createdAt as number) > 0
      ? (candidate.createdAt as number)
      : Date.now(),
    ...(previousKeys.length > 0 ? { previousKeys } : {}),
  };
};

const parseRoomKeySnapshots = (value: unknown): ReadonlyArray<RoomKeySnapshot> => {
  if (!Array.isArray(value)) {
    return [];
  }
  const byGroupId = new Map<string, RoomKeySnapshot>();
  value.forEach((entry) => {
    const normalized = normalizeRoomKeySnapshot(entry);
    if (!normalized) {
      return;
    }
    const existing = byGroupId.get(normalized.groupId);
    if (!existing) {
      byGroupId.set(normalized.groupId, normalized);
      return;
    }
    const incomingWins = normalized.createdAt >= existing.createdAt;
    const latest = incomingWins ? normalized : existing;
    const older = incomingWins ? existing : normalized;
    const mergedPrevious = uniqueStrings([
      ...(latest.previousKeys ?? []),
      ...(older.previousKeys ?? []),
      older.roomKeyHex,
    ]).filter((key) => key !== latest.roomKeyHex);
    byGroupId.set(normalized.groupId, {
      groupId: latest.groupId,
      roomKeyHex: latest.roomKeyHex,
      createdAt: latest.createdAt,
      ...(mergedPrevious.length > 0 ? { previousKeys: mergedPrevious } : {}),
    });
  });
  return Array.from(byGroupId.values()).sort((left, right) => left.groupId.localeCompare(right.groupId));
};

const mergeRoomKeySnapshots = (
  localRoomKeys: ReadonlyArray<RoomKeySnapshot>,
  incomingRoomKeys: ReadonlyArray<RoomKeySnapshot>,
): ReadonlyArray<RoomKeySnapshot> => {
  return parseRoomKeySnapshots([
    ...localRoomKeys,
    ...incomingRoomKeys,
  ]);
};

const loadLocalRoomKeySnapshots = async (): Promise<ReadonlyArray<RoomKeySnapshot>> => {
  try {
    return parseRoomKeySnapshots(await roomKeyStore.listRoomKeyRecords());
  } catch {
    return [];
  }
};

const applyRoomKeySnapshots = async (roomKeys: ReadonlyArray<RoomKeySnapshot>): Promise<void> => {
  for (const roomKey of roomKeys) {
    await roomKeyStore.upsertRoomKeyRecord({
      groupId: roomKey.groupId,
      roomKeyHex: roomKey.roomKeyHex,
      previousKeys: roomKey.previousKeys ? [...roomKey.previousKeys] : undefined,
      createdAt: roomKey.createdAt,
    });
  }
};

const selectJoinedGroupIds = (
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlySet<string> => {
  const joinedGroupIds = new Set<string>();
  entries.forEach((entry) => {
    if (entry.status === "joined" && entry.groupId.trim().length > 0) {
      joinedGroupIds.add(entry.groupId.trim());
    }
  });
  return joinedGroupIds;
};

const filterRoomKeySnapshotsToJoinedEvidence = (params: Readonly<{
  roomKeys: ReadonlyArray<RoomKeySnapshot>;
  explicitLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  chatState: PersistedChatState | null | undefined;
}>): ReadonlyArray<RoomKeySnapshot> => {
  const normalizedRoomKeys = parseRoomKeySnapshots(params.roomKeys);
  if (normalizedRoomKeys.length === 0) {
    return [];
  }
  const reconstructedLedgerEntries = reconstructCommunityMembershipFromChatState(params.chatState);
  const mergedLedgerEntries = mergeCommunityMembershipLedgerEntries(
    params.explicitLedgerEntries,
    reconstructedLedgerEntries,
  );
  const joinedGroupIds = selectJoinedGroupIds(mergedLedgerEntries);
  if (joinedGroupIds.size === 0) {
    return [];
  }
  return normalizedRoomKeys.filter((roomKey) => joinedGroupIds.has(roomKey.groupId.trim()));
};

const reconstructRoomKeySnapshotsFromChatState = (
  chatState: PersistedChatState | null | undefined,
  options?: Readonly<{
    restrictToJoinedGroupIds?: ReadonlySet<string>;
  }>,
): ReadonlyArray<RoomKeySnapshot> => {
  const reconstructed = reconstructRoomKeysFromChatState(chatState);
  if (reconstructed.length === 0) {
    return [];
  }
  const joinedGroupIds = options?.restrictToJoinedGroupIds;
  const filtered = (joinedGroupIds && joinedGroupIds.size > 0)
    ? reconstructed.filter((entry) => joinedGroupIds.has(entry.groupId))
    : reconstructed;
  return parseRoomKeySnapshots(filtered);
};

const isThemePreference = (value: unknown): value is UiSettingsSnapshot["themePreference"] => (
  value === "system" || value === "light" || value === "dark"
);

const isTextScale = (value: unknown): value is UiSettingsSnapshot["accessibilityPreferences"]["textScale"] => (
  value === 90 || value === 100 || value === 110 || value === 120
);

const parseAccessibilityPreferences = (value: unknown): UiSettingsSnapshot["accessibilityPreferences"] => {
  if (!value || typeof value !== "object") {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }
  const candidate = value as Partial<UiSettingsSnapshot["accessibilityPreferences"]>;
  return {
    textScale: isTextScale(candidate.textScale) ? candidate.textScale : DEFAULT_ACCESSIBILITY_PREFERENCES.textScale,
    reducedMotion: typeof candidate.reducedMotion === "boolean" ? candidate.reducedMotion : DEFAULT_ACCESSIBILITY_PREFERENCES.reducedMotion,
    contrastAssist: typeof candidate.contrastAssist === "boolean" ? candidate.contrastAssist : DEFAULT_ACCESSIBILITY_PREFERENCES.contrastAssist,
  };
};

const readLocalStorageValue = (scopedKey: string, legacyKey: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(scopedKey) ?? window.localStorage.getItem(legacyKey);
  } catch {
    return null;
  }
};

const buildUiSettingsSnapshot = (profileId: string): UiSettingsSnapshot => {
  const themeRaw = readLocalStorageValue(
    getScopedStorageKey(THEME_STORAGE_KEY, profileId),
    THEME_STORAGE_KEY,
  );
  const accessibilityRaw = readLocalStorageValue(
    getScopedStorageKey(ACCESSIBILITY_STORAGE_KEY, profileId),
    ACCESSIBILITY_STORAGE_KEY,
  );
  let parsedAccessibility: UiSettingsSnapshot["accessibilityPreferences"] = DEFAULT_ACCESSIBILITY_PREFERENCES;
  if (accessibilityRaw) {
    try {
      parsedAccessibility = parseAccessibilityPreferences(JSON.parse(accessibilityRaw));
    } catch {
      parsedAccessibility = DEFAULT_ACCESSIBILITY_PREFERENCES;
    }
  }
  return {
    themePreference: isThemePreference(themeRaw) ? themeRaw : DEFAULT_THEME_PREFERENCE,
    accessibilityPreferences: parsedAccessibility,
    localMediaStorageConfig: getLocalMediaStorageConfig(),
  };
};

const persistUiSettingsSnapshot = (profileId: string, uiSettings: UiSettingsSnapshot | undefined): void => {
  if (!uiSettings || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      getScopedStorageKey(THEME_STORAGE_KEY, profileId),
      uiSettings.themePreference,
    );
    window.localStorage.setItem(
      getScopedStorageKey(ACCESSIBILITY_STORAGE_KEY, profileId),
      JSON.stringify(uiSettings.accessibilityPreferences),
    );
  } catch {
    // Best-effort storage sync.
  }
  saveLocalMediaStorageConfig(
    uiSettings.localMediaStorageConfig ?? DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG,
  );
};


const isNonEmptyChatState = (value: EncryptedAccountBackupPayload["chatState"]): boolean => {
  if (!value) {
    return false;
  }
  const persistedMessageCount = getPersistedMessageCount(value);
  const persistedGroupMessageCount = getPersistedGroupMessageCount(value);
  return value.createdConnections.length > 0
    || value.createdGroups.length > 0
    || (value.connectionRequests?.length ?? 0) > 0
    || (value.pinnedChatIds?.length ?? 0) > 0
    || (value.hiddenChatIds?.length ?? 0) > 0
    || Object.keys(value.connectionOverridesByConnectionId).length > 0
    || Object.keys(value.unreadByConversationId).length > 0
    || persistedMessageCount > 0
    || persistedGroupMessageCount > 0;
};


const isDefaultPrivacySettings = (value: EncryptedAccountBackupPayload["privacySettings"]): boolean => {
  return JSON.stringify(value) === JSON.stringify(defaultPrivacySettings);
};

const isDefaultRelayList = (publicKeyHex: PublicKeyHex, relayList: RelayListSnapshot): boolean => {
  const defaults = relayListInternals.DEFAULT_RELAYS;
  if (relayList.length !== defaults.length) {
    return false;
  }
  return relayList.every((relay, index) => (
    relay.url === defaults[index]?.url && relay.enabled === defaults[index]?.enabled
  ));
};

const isExistingLocalPrivateState = (publicKeyHex: PublicKeyHex): boolean => {
  const peerTrust = peerTrustInternals.loadFromStorage(publicKeyHex);
  const evidence = requestFlowEvidenceStoreInternals.readState();
  const outbox = contactRequestOutboxInternals.readState();
  const checkpoints = Array.from(syncCheckpointInternals.loadPersistedCheckpointState().values());
  const chatState = chatStateStoreService.load(publicKeyHex);
  const relayList = relayListInternals.loadRelayListFromStorage(publicKeyHex);
  const profile = useProfileInternals.loadFromStorage().profile;
  const hasProfileDraft = profile.username.trim().length > 0
    || (profile.about ?? "").trim().length > 0
    || profile.avatarUrl.trim().length > 0
    || profile.nip05.trim().length > 0;
  return peerTrust.acceptedPeers.length > 0
    || peerTrust.mutedPeers.length > 0
    || Object.keys(evidence.byPeer).length > 0
    || outbox.records.length > 0
    || checkpoints.length > 0
    || isNonEmptyChatState(chatState)
    || hasProfileDraft
    || !isDefaultRelayList(publicKeyHex, relayList)
    || !isDefaultPrivacySettings(PrivacySettingsService.getSettings());
};

const toIdentityUnlockSnapshot = (record: IdentityRecord): IdentityUnlockSnapshot => ({
  encryptedPrivateKey: record.encryptedPrivateKey,
  username: record.username,
});

const readLocalIdentityUnlockSnapshot = async (
  publicKeyHex: PublicKeyHex
): Promise<IdentityUnlockSnapshot | undefined> => {
  try {
    const stored = await getStoredIdentity();
    if (!stored.record || stored.record.publicKeyHex !== publicKeyHex) {
      return undefined;
    }
    return toIdentityUnlockSnapshot(stored.record);
  } catch {
    return undefined;
  }
};

const persistIdentityUnlockSnapshot = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  identityUnlock: IdentityUnlockSnapshot | undefined;
  profileUsername?: string;
}>): Promise<void> => {
  const incoming = params.identityUnlock;
  if (!incoming || incoming.encryptedPrivateKey.trim().length === 0) {
    return;
  }

  let localRecord: IdentityRecord | undefined;
  try {
    localRecord = (await getStoredIdentity()).record;
  } catch {
    localRecord = undefined;
  }

  const localIdentityUnlock = localRecord && localRecord.publicKeyHex === params.publicKeyHex
    ? toIdentityUnlockSnapshot(localRecord)
    : undefined;
  const merged = mergeIdentityUnlock(localIdentityUnlock, incoming);
  if (!merged) {
    return;
  }

  const username = (
    merged.username?.trim()
    || localRecord?.username?.trim()
    || params.profileUsername?.trim()
    || undefined
  );
  await saveStoredIdentity({
    record: {
      publicKeyHex: params.publicKeyHex,
      encryptedPrivateKey: merged.encryptedPrivateKey,
      username,
    },
  });
};

const mergePeerTrust = (
  current: StoredPeerTrustSnapshot,
  incoming: StoredPeerTrustSnapshot
): StoredPeerTrustSnapshot => ({
  acceptedPeers: uniqueStrings([...current.acceptedPeers, ...incoming.acceptedPeers]) as ReadonlyArray<PublicKeyHex>,
  mutedPeers: uniqueStrings([...current.mutedPeers, ...incoming.mutedPeers]) as ReadonlyArray<PublicKeyHex>,
});

const mergeRequestFlowEvidence = (
  current: RequestFlowEvidenceStateSnapshot,
  incoming: RequestFlowEvidenceStateSnapshot
): RequestFlowEvidenceStateSnapshot => {
  const byPeer: Record<string, RequestFlowEvidenceStateSnapshot["byPeer"][string]> = {
    ...current.byPeer,
  };
  for (const [peerPublicKeyHex, evidence] of Object.entries(incoming.byPeer)) {
    const existing = byPeer[peerPublicKeyHex];
    if (!existing || (evidence.lastEvidenceUnixMs ?? 0) >= (existing.lastEvidenceUnixMs ?? 0)) {
      byPeer[peerPublicKeyHex] = evidence;
    }
  }
  return { byPeer };
};

const mergeOutbox = (
  current: ContactRequestOutboxSnapshot,
  incoming: ContactRequestOutboxSnapshot
): ContactRequestOutboxSnapshot => {
  const recordsByPeer = new Map<string, ContactRequestRecord>();
  const visit = (record: ContactRequestRecord): void => {
    const peerPubkey = record.peerPubkey;
    const currentValue = recordsByPeer.get(peerPubkey);
    const currentUpdatedAt = typeof currentValue?.updatedAtUnixMs === "number" ? currentValue.updatedAtUnixMs : 0;
    const candidateUpdatedAt = typeof record.updatedAtUnixMs === "number" ? record.updatedAtUnixMs : 0;
    if (!currentValue || candidateUpdatedAt >= currentUpdatedAt) {
      recordsByPeer.set(peerPubkey, record);
    }
  };
  current.records.forEach(visit);
  incoming.records.forEach(visit);
  return { records: Array.from(recordsByPeer.values()) };
};

const mergeCheckpoints = (
  current: SyncCheckpointSnapshot,
  incoming: SyncCheckpointSnapshot
): SyncCheckpointSnapshot => {
  const checkpoints = new Map<string, SyncCheckpointSnapshot[number]>();
  for (const checkpoint of [...current, ...incoming]) {
    const existing = checkpoints.get(checkpoint.timelineKey);
    if (!existing || checkpoint.updatedAtUnixMs >= existing.updatedAtUnixMs) {
      checkpoints.set(checkpoint.timelineKey, checkpoint);
    }
  }
  return Array.from(checkpoints.values());
};

const mergeRelayList = (
  current: RelayListSnapshot,
  incoming: RelayListSnapshot
): RelayListSnapshot => {
  const byUrl = new Map<string, RelayListSnapshot[number]>();
  for (const relay of [...current, ...incoming]) {
    if (!relay.url.trim()) {
      continue;
    }
    byUrl.set(relay.url.trim(), { url: relay.url.trim(), enabled: relay.enabled });
  }
  return Array.from(byUrl.values());
};


const saveRecoverySnapshot = (publicKeyHex: PublicKeyHex, payload: EncryptedAccountBackupPayload): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getRecoverySnapshotStorageKey(publicKeyHex), JSON.stringify(payload));
  } catch {
    // Snapshot is best-effort only.
  }
};

const loadRecoverySnapshot = (publicKeyHex: PublicKeyHex): EncryptedAccountBackupPayload | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(getRecoverySnapshotStorageKey(publicKeyHex));
    if (!raw) {
      return null;
    }
    const parsed = parseBackupPayload(JSON.parse(raw));
    if (!parsed || parsed.publicKeyHex !== publicKeyHex) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const parseMessageDeleteTombstones = (
  value: unknown,
): ReadonlyArray<MessageDeleteTombstoneSnapshotEntry> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return normalizeMessageDeleteTombstoneEntries(
    value.filter((entry): entry is MessageDeleteTombstoneSnapshotEntry => (
      !!entry
      && typeof entry === "object"
      && typeof (entry as { id?: unknown }).id === "string"
      && typeof (entry as { deletedAtUnixMs?: unknown }).deletedAtUnixMs === "number"
    )),
  );
};

const buildBackupPayload = (
  publicKeyHex: PublicKeyHex,
  chatStateOverride?: EncryptedAccountBackupPayload["chatState"],
  roomKeyOverride?: ReadonlyArray<RoomKeySnapshot>,
): EncryptedAccountBackupPayload => {
  const profileId = getActiveProfileIdSafe();
  const messageDeleteTombstones = loadMessageDeleteTombstoneEntries();
  const chatState = sanitizePersistedChatStateMessagesByDeleteContract(
    chatStateOverride ?? chatStateStoreService.load(publicKeyHex),
    { durableDeleteIds: toMessageDeleteTombstoneIdSet(messageDeleteTombstones) }
  );
  const communityMembershipLedger = loadCommunityMembershipLedger(publicKeyHex);
  const roomKeys = filterRoomKeySnapshotsToJoinedEvidence({
    roomKeys: parseRoomKeySnapshots(roomKeyOverride ?? []),
    explicitLedgerEntries: communityMembershipLedger,
    chatState,
  });
  const payload: EncryptedAccountBackupPayload = {
    version: 1,
    publicKeyHex,
    createdAtUnixMs: Date.now(),
    profile: useProfileInternals.loadFromStorage().profile,
    peerTrust: peerTrustInternals.loadFromStorage(publicKeyHex),
    requestFlowEvidence: requestFlowEvidenceStoreInternals.readState(),
    requestOutbox: contactRequestOutboxInternals.readState(),
    syncCheckpoints: Array.from(syncCheckpointInternals.loadPersistedCheckpointState().values()),
    ...(messageDeleteTombstones.length > 0 ? { messageDeleteTombstones } : {}),
    chatState,
    privacySettings: PrivacySettingsService.getSettings(),
    relayList: relayListInternals.loadRelayListFromStorage(publicKeyHex),
    uiSettings: buildUiSettingsSnapshot(profileId),
  };
  if (communityMembershipLedger.length === 0 && roomKeys.length === 0) {
    return payload;
  }
  return {
    ...payload,
    ...(communityMembershipLedger.length > 0 ? { communityMembershipLedger } : {}),
    ...(roomKeys.length > 0 ? { roomKeys } : {}),
  };
};

const buildBackupPayloadWithHydratedChatState = async (publicKeyHex: PublicKeyHex): Promise<EncryptedAccountBackupPayload> => {
  await chatStateStoreService.hydrateMessages(publicKeyHex);
  const hydratedChatState = await hydrateChatStateFromIndexedMessages(
    publicKeyHex,
    chatStateStoreService.load(publicKeyHex)
  );
  const localRoomKeys = await loadLocalRoomKeySnapshots();
  const reconstructedRoomKeys = reconstructRoomKeySnapshotsFromChatState(hydratedChatState);
  const roomKeys = mergeRoomKeySnapshots(localRoomKeys, reconstructedRoomKeys);
  const basePayload = buildBackupPayload(publicKeyHex, hydratedChatState, roomKeys);
  const identityUnlock = await readLocalIdentityUnlockSnapshot(publicKeyHex);
  if (!identityUnlock) {
    return basePayload;
  }
  return {
    ...basePayload,
    identityUnlock,
  };
};

const parseBackupPayload = (value: unknown): EncryptedAccountBackupPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const parsed = value as Partial<EncryptedAccountBackupPayload>;
  if (parsed.version !== 1 || typeof parsed.publicKeyHex !== "string" || typeof parsed.createdAtUnixMs !== "number") {
    return null;
  }
  const profileId = getActiveProfileIdSafe();
  const fallbackUiSettings = buildUiSettingsSnapshot(profileId);
  const parsedUiSettings = parsed.uiSettings && typeof parsed.uiSettings === "object"
    ? parsed.uiSettings as Partial<UiSettingsSnapshot>
    : null;
  const parsedLocalMediaConfig = parsedUiSettings?.localMediaStorageConfig;
  const localMediaStorageConfig = (
    parsedLocalMediaConfig && typeof parsedLocalMediaConfig === "object"
      ? {
        ...DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG,
        ...parsedLocalMediaConfig,
      }
      : fallbackUiSettings.localMediaStorageConfig
  );
  const communityMembershipLedger = parseCommunityMembershipLedgerSnapshot(parsed.communityMembershipLedger);
  const roomKeys = parseRoomKeySnapshots(parsed.roomKeys);
  const messageDeleteTombstones = parseMessageDeleteTombstones(parsed.messageDeleteTombstones);
  const chatState = sanitizePersistedChatStateMessagesByDeleteContract(parsed.chatState ?? null, {
    durableDeleteIds: toMessageDeleteTombstoneIdSet(messageDeleteTombstones),
  });
  const payload: EncryptedAccountBackupPayload = {
    version: 1,
    publicKeyHex: parsed.publicKeyHex as PublicKeyHex,
    createdAtUnixMs: parsed.createdAtUnixMs,
    identityUnlock: isIdentityUnlockSnapshot(parsed.identityUnlock) ? parsed.identityUnlock : undefined,
    profile: parsed.profile ?? useProfileInternals.loadFromStorage().profile,
    peerTrust: parsed.peerTrust ?? { acceptedPeers: [], mutedPeers: [] },
    requestFlowEvidence: parsed.requestFlowEvidence ?? { byPeer: {} },
    requestOutbox: parsed.requestOutbox ?? { records: [] },
    syncCheckpoints: Array.isArray(parsed.syncCheckpoints) ? parsed.syncCheckpoints : [],
    ...(messageDeleteTombstones.length > 0 ? { messageDeleteTombstones } : {}),
    chatState,
    privacySettings: parsed.privacySettings ?? defaultPrivacySettings,
    relayList: Array.isArray(parsed.relayList) ? parsed.relayList : [],
    uiSettings: {
      themePreference: isThemePreference(parsedUiSettings?.themePreference)
        ? parsedUiSettings.themePreference
        : fallbackUiSettings.themePreference,
      accessibilityPreferences: parseAccessibilityPreferences(parsedUiSettings?.accessibilityPreferences),
      localMediaStorageConfig,
    },
  };
  if (communityMembershipLedger.length === 0 && roomKeys.length === 0) {
    return payload;
  }
  return {
    ...payload,
    ...(communityMembershipLedger.length > 0 ? { communityMembershipLedger } : {}),
    ...(roomKeys.length > 0 ? { roomKeys } : {}),
  };
};

const parsePortableAccountBundle = (value: unknown): PortableAccountBundle | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const parsed = value as Partial<PortableAccountBundle>;
  if (parsed.version !== 1 || parsed.format !== PORTABLE_ACCOUNT_BUNDLE_FORMAT || parsed.payloadVersion !== 1) {
    return null;
  }
  if (typeof parsed.publicKeyHex !== "string" || parsed.publicKeyHex.trim().length === 0) {
    return null;
  }
  if (typeof parsed.ciphertext !== "string" || parsed.ciphertext.trim().length === 0) {
    return null;
  }
  if (typeof parsed.exportedAtUnixMs !== "number" || !Number.isFinite(parsed.exportedAtUnixMs) || parsed.exportedAtUnixMs <= 0) {
    return null;
  }
  return {
    version: 1,
    format: PORTABLE_ACCOUNT_BUNDLE_FORMAT,
    payloadVersion: 1,
    exportedAtUnixMs: parsed.exportedAtUnixMs,
    publicKeyHex: parsed.publicKeyHex as PublicKeyHex,
    ciphertext: parsed.ciphertext,
  };
};

const fetchLatestBackupEvent = async (
  pool: RelayPoolWithSubscribe,
  publicKeyHex: PublicKeyHex
): Promise<NostrEvent | null> => {
  await pool.waitForConnection(2_000);
  const normalizeRelayUrl = (value: string): string => value.trim();
  const openRelayUrls = new Set(
    pool.connections
      .filter((connection) => connection.status === "open")
      .map((connection) => normalizeRelayUrl(connection.url))
      .filter((relayUrl) => relayUrl.length > 0)
  );
  const poolFetchResult = await new Promise<Readonly<{
    event: NostrEvent | null;
    candidateCount: number;
    receivedEoseRelayCount: number;
    timedOut: boolean;
  }>>((resolve) => {
    const subId = `account-backup-${Math.random().toString(36).slice(2, 10)}`;
    const expectedEoseRelayUrls = openRelayUrls;
    const receivedEoseRelayUrls = new Set<string>();
    let latestEvent: NostrEvent | null = null;
    let candidateCount = 0;
    let timedOut = false;
    let timeoutId: number | null = null;
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      cleanup();
      resolve({
        event: latestEvent,
        candidateCount,
        receivedEoseRelayCount: receivedEoseRelayUrls.size,
        timedOut,
      });
    };
    const cleanup = pool.subscribeToMessages(({ message, url }) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed[1] !== subId) {
          return;
        }
        if (parsed[0] === "EVENT") {
          const event = parsed[2] as NostrEvent;
          if (
            event.kind === ACCOUNT_BACKUP_EVENT_KIND
            && event.pubkey === publicKeyHex
            && event.tags.some((tag) => tag[0] === "d" && tag[1] === ACCOUNT_BACKUP_D_TAG)
          ) {
            candidateCount += 1;
            if (!latestEvent || compareBackupEvents(event, latestEvent) > 0) {
              latestEvent = event;
            }
          }
        }
        if (parsed[0] === "EOSE") {
          if (expectedEoseRelayUrls.size === 0) {
            finish();
            return;
          }
          const relayUrl = normalizeRelayUrl(url);
          if (expectedEoseRelayUrls.has(relayUrl)) {
            receivedEoseRelayUrls.add(relayUrl);
          }
          if (receivedEoseRelayUrls.size >= expectedEoseRelayUrls.size) {
            finish();
          }
        }
      } catch {
        // Ignore malformed relay frames.
      }
    });
    pool.sendToOpen(JSON.stringify([
      "REQ",
      subId,
      {
        authors: [publicKeyHex],
        kinds: [ACCOUNT_BACKUP_EVENT_KIND],
        "#d": [ACCOUNT_BACKUP_D_TAG],
        limit: 5,
      },
    ]));
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      finish();
    }, BACKUP_FETCH_TIMEOUT_MS);
  });
  const poolExpectedEoseRelayCount = openRelayUrls.size;
  if (poolFetchResult.event) {
    emitBackupRestoreSelectionDiagnostics({
      diagnostics: {
        source: "pool",
        publicKeyHex,
        selectedEvent: poolFetchResult.event,
        poolOpenRelayCount: openRelayUrls.size,
        poolExpectedEoseRelayCount,
        poolReceivedEoseRelayCount: poolFetchResult.receivedEoseRelayCount,
        poolCandidateCount: poolFetchResult.candidateCount,
        poolTimedOut: poolFetchResult.timedOut,
        fallbackRelayCount: 0,
      },
      parseBackupCreatedAtMsTag,
    });
    return poolFetchResult.event;
  }
  const fallbackRelayUrls = getCandidateRelayUrls(pool);
  const fallbackEvent = await fetchLatestEventFromRelayUrls({
    relayUrls: fallbackRelayUrls,
    filters: [{
      authors: [publicKeyHex],
      kinds: [ACCOUNT_BACKUP_EVENT_KIND],
      "#d": [ACCOUNT_BACKUP_D_TAG],
      limit: 5,
    }],
    matcher: (event) => (
      event.kind === ACCOUNT_BACKUP_EVENT_KIND
      && event.pubkey === publicKeyHex
      && event.tags.some((tag) => tag[0] === "d" && tag[1] === ACCOUNT_BACKUP_D_TAG)
    ),
    timeoutMs: BACKUP_FETCH_TIMEOUT_MS,
  });
  emitBackupRestoreSelectionDiagnostics({
    diagnostics: {
      source: fallbackEvent ? "direct" : "none",
      publicKeyHex,
      selectedEvent: fallbackEvent,
      poolOpenRelayCount: openRelayUrls.size,
      poolExpectedEoseRelayCount,
      poolReceivedEoseRelayCount: poolFetchResult.receivedEoseRelayCount,
      poolCandidateCount: poolFetchResult.candidateCount,
      poolTimedOut: poolFetchResult.timedOut,
      fallbackRelayCount: fallbackRelayUrls.length,
    },
    parseBackupCreatedAtMsTag,
  });
  return fallbackEvent;
};

const toEnvelope = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  ciphertext: string;
}>): EncryptedAccountBackupEnvelope => ({
  version: 1,
  publicKeyHex: params.publicKeyHex,
  createdAtUnixMs: Date.now(),
  ciphertext: params.ciphertext,
  backupEventKind: ACCOUNT_BACKUP_EVENT_KIND,
  dTag: ACCOUNT_BACKUP_D_TAG,
});

const reconcileIncomingLedgerWithReconstructedJoinedEvidence = (params: Readonly<{
  incomingExplicitEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  reconstructedEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
}>): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const reconstructedJoinedByKey = new Map<string, CommunityMembershipLedgerEntry>();
  for (const entry of params.reconstructedEntries) {
    if (entry.status !== "joined") {
      continue;
    }
    reconstructedJoinedByKey.set(toCommunityMembershipLedgerKey(entry), entry);
  }

  return params.incomingExplicitEntries.map((entry) => {
    if (entry.status !== "left") {
      return entry;
    }
    const reconstructedJoinedEntry = reconstructedJoinedByKey.get(
      toCommunityMembershipLedgerKey(entry),
    );
    if (!reconstructedJoinedEntry) {
      return entry;
    }
    if (reconstructedJoinedEntry.updatedAtUnixMs < entry.updatedAtUnixMs) {
      return entry;
    }
    return {
      ...entry,
      status: "joined",
      updatedAtUnixMs: reconstructedJoinedEntry.updatedAtUnixMs,
      communityId: reconstructedJoinedEntry.communityId || entry.communityId,
      displayName: reconstructedJoinedEntry.displayName ?? entry.displayName,
      avatar: reconstructedJoinedEntry.avatar ?? entry.avatar,
      lastEvidenceEventId: reconstructedJoinedEntry.lastEvidenceEventId ?? entry.lastEvidenceEventId,
    };
  });
};

const mergeIncomingRestorePayload = async (
  publicKeyHex: PublicKeyHex,
  payload: EncryptedAccountBackupPayload,
  options?: Readonly<{
    includeHydratedLocalMessages?: boolean;
  }>,
): Promise<EncryptedAccountBackupPayload> => {
  const incomingMessageDeleteTombstones = normalizeMessageDeleteTombstoneEntries(
    payload.messageDeleteTombstones ?? []
  );
  const sanitizedIncomingChatState = sanitizePersistedChatStateMessagesByDeleteContract(payload.chatState, {
    durableDeleteIds: toMessageDeleteTombstoneIdSet(incomingMessageDeleteTombstones),
  });
  const sanitizedIncomingPayload: EncryptedAccountBackupPayload = hasReplayableChatHistory(sanitizedIncomingChatState)
    ? {
      ...payload,
      ...(incomingMessageDeleteTombstones.length > 0 ? { messageDeleteTombstones: incomingMessageDeleteTombstones } : {}),
      chatState: sanitizedIncomingChatState,
    }
    : {
      ...payload,
      ...(incomingMessageDeleteTombstones.length > 0 ? { messageDeleteTombstones: incomingMessageDeleteTombstones } : {}),
      chatState: sanitizedIncomingChatState,
      syncCheckpoints: [],
    };
  const existingLocalPrivateState = isExistingLocalPrivateState(publicKeyHex);
  const freshDevice = !existingLocalPrivateState;
  const existingLedgerEntries = loadCommunityMembershipLedger(publicKeyHex);
  const existingRoomKeySnapshots = await loadLocalRoomKeySnapshots();
  const includeHydratedLocalMessages = options?.includeHydratedLocalMessages !== false;
  const recoverySnapshot = loadRecoverySnapshot(publicKeyHex);
  const recoverySnapshotHasReplayableHistory = hasReplayableChatHistory(recoverySnapshot?.chatState ?? null);
  const recoverySnapshotHasExplicitLedgerEvidence = (
    parseCommunityMembershipLedgerSnapshot(recoverySnapshot?.communityMembershipLedger).length > 0
  );
  const recoverySnapshotHasExplicitRoomKeyEvidence = (
    parseRoomKeySnapshots(recoverySnapshot?.roomKeys).length > 0
  );
  const shouldUseRecoverySnapshot = Boolean(
    recoverySnapshot
    && (
      recoverySnapshotHasReplayableHistory
      || recoverySnapshotHasExplicitLedgerEvidence
      || recoverySnapshotHasExplicitRoomKeyEvidence
    ),
  );
  const canTrustIncomingPortableState = hasPortablePrivateStateEvidence(sanitizedIncomingPayload, hasReplayableChatHistory);
  // CRITICAL FIX: Fresh devices with valid incoming backups need proper hydration
  // to ensure local state is fully captured for merging. The previous logic would
  // skip hydration on fresh devices when canTrustIncomingPortableState was true,
  // causing message/media loss during restore.
  const shouldHydrateLocalMessages = (
    includeHydratedLocalMessages
    && (
      !freshDevice                    // Existing device: always hydrate local state
      || shouldUseRecoverySnapshot    // Fresh device with recovery snapshot: hydrate
      || (!canTrustIncomingPortableState && !sanitizedIncomingPayload.chatState)  // Fresh device with no/empty backup: hydrate what exists locally
    )
  );
  const currentPayloadCandidate = includeHydratedLocalMessages
    ? (shouldHydrateLocalMessages
      ? await buildBackupPayloadWithHydratedChatState(publicKeyHex)
      : buildBackupPayload(publicKeyHex))
    : buildBackupPayload(publicKeyHex);
  const existingScopedRoomKeySnapshots = filterRoomKeySnapshotsToJoinedEvidence({
    roomKeys: existingRoomKeySnapshots,
    explicitLedgerEntries: existingLedgerEntries,
    chatState: currentPayloadCandidate.chatState,
  });
  const hasHydratedLocalReplayableHistory = hasReplayableChatHistory(currentPayloadCandidate.chatState);
  const hasExplicitLocalLedgerEvidence = (
    parseCommunityMembershipLedgerSnapshot(currentPayloadCandidate.communityMembershipLedger).length > 0
    || existingLedgerEntries.length > 0
  );
  const hasExplicitLocalRoomKeyEvidence = (
    parseRoomKeySnapshots(currentPayloadCandidate.roomKeys).length > 0
    || existingScopedRoomKeySnapshots.length > 0
  );
  const hasExplicitLocalMessageDeleteEvidence = (
    (currentPayloadCandidate.messageDeleteTombstones?.length ?? 0) > 0
  );
  const currentPayload = (
    existingLocalPrivateState
    || hasHydratedLocalReplayableHistory
    || hasExplicitLocalLedgerEvidence
    || hasExplicitLocalRoomKeyEvidence
    || hasExplicitLocalMessageDeleteEvidence
  )
    ? currentPayloadCandidate
    : shouldUseRecoverySnapshot
      ? recoverySnapshot
      : null;
  if (currentPayload) {
    saveRecoverySnapshot(publicKeyHex, currentPayload);
  }
  // Orchestrate restore merge via centralized module
  const orchestrationResult = orchestrateRestoreMerge({
    publicKeyHex,
    sanitizedIncomingPayload,
    currentPayload,
    existingLedgerEntries,
    existingRoomKeySnapshots: existingScopedRoomKeySnapshots,
    freshDevice,
    shouldHydrateLocalMessages,
    canTrustIncomingPortableState,
    recoverySnapshot,
    recoverySnapshotHasReplayableHistory,
    recoverySnapshotHasExplicitLedgerEvidence,
    recoverySnapshotHasExplicitRoomKeyEvidence,
    hasHydratedLocalReplayableHistory,
    hasExplicitLocalLedgerEvidence,
    hasExplicitLocalRoomKeyEvidence,
    hasExplicitLocalMessageDeleteEvidence,
  });

  const {
    mergedPayload,
    mergedMessageDeleteTombstones,
    mergedChatState,
    incomingLedgerEntries,
    reconciledIncomingLedgerEntries,
    reconstructedMergedLedgerEntries,
    localExplicitLedgerEntries,
    mergedCommunityMembershipLedger,
    incomingRoomKeySnapshots,
    localExplicitRoomKeySnapshots,
    mergedExplicitRoomKeys,
    reconstructedMergedRoomKeySnapshots,
    mergedRoomKeys,
  } = orchestrationResult;
  emitMergeCompletionDiagnostics({
    publicKeyHex,
    freshDevice,
    includeHydratedLocalMessages,
    shouldHydrateLocalMessages,
    canTrustIncomingPortableState,
    localPayloadMerged: currentPayload !== null,
    hasHydratedLocalReplayableHistory,
    hasExplicitLocalLedgerEvidence,
    hasExplicitLocalRoomKeyEvidence,
    hasExplicitLocalMessageDeleteEvidence,
    recoverySnapshotAvailable: recoverySnapshot !== null,
    recoverySnapshotUsed: (
      currentPayload !== null
      && recoverySnapshot !== null
      && currentPayload.createdAtUnixMs === recoverySnapshot.createdAtUnixMs
    ),
    recoverySnapshotHasReplayableHistory,
    recoverySnapshotHasExplicitLedgerEvidence,
    recoverySnapshotHasExplicitRoomKeyEvidence,
    incomingMessageDeleteTombstones: sanitizedIncomingPayload.messageDeleteTombstones ?? [],
    localMessageDeleteTombstones: currentPayload?.messageDeleteTombstones ?? [],
    mergedMessageDeleteTombstones,
    incomingLedgerEntries,
    reconciledIncomingLedgerEntries,
    reconstructedMergedLedgerEntries,
    localExplicitLedgerEntries,
    mergedCommunityMembershipLedger,
    incomingRoomKeySnapshots,
    localExplicitRoomKeySnapshots,
    mergedExplicitRoomKeys,
    reconstructedMergedRoomKeySnapshots,
    mergedRoomKeys,
    incomingPayload: sanitizedIncomingPayload,
    currentPayload,
    mergedPayload,
    summarizeChatStateDiagnostics: summarizePersistedChatStateMessages,
    toPrefixedChatStateDiagnosticsContext,
  });
  return mergedPayload;
};

const applyBackupPayload = async (
  publicKeyHex: PublicKeyHex,
  payload: EncryptedAccountBackupPayload,
  profileId = getActiveProfileIdSafe(),
): Promise<void> => {
  const mergedPayload = await mergeIncomingRestorePayload(publicKeyHex, payload, {
    includeHydratedLocalMessages: true,
  });

  await persistIdentityUnlockSnapshot({
    publicKeyHex,
    identityUnlock: mergedPayload.identityUnlock,
    profileUsername: mergedPayload.profile.username,
  });

  useProfileInternals.saveToStorage({ profile: mergedPayload.profile });
  useProfileInternals.setState({ profile: mergedPayload.profile });
  useProfileInternals.notify();
  peerTrustInternals.saveToStorage(publicKeyHex, mergedPayload.peerTrust);
  requestFlowEvidenceStoreInternals.writeState(mergedPayload.requestFlowEvidence);
  contactRequestOutboxInternals.writeState(mergedPayload.requestOutbox);
  syncCheckpointInternals.persistCheckpointState(new Map(
    mergedPayload.syncCheckpoints.map((checkpoint) => [checkpoint.timelineKey, checkpoint])
  ));
  replaceMessageDeleteTombstones(mergedPayload.messageDeleteTombstones ?? []);
  const mergedPayloadChatDiagnostics = summarizePersistedChatStateMessages(mergedPayload.chatState, publicKeyHex);
  if (mergedPayload.chatState) {
    // Backup restore should not immediately trigger mutation-driven backup publish.
    chatStateStoreService.replace(publicKeyHex, mergedPayload.chatState, {
      emitMutationSignal: false,
      profileId,
    });
    const restoredChatStateDiagnostics = summarizePersistedChatStateMessages(
      chatStateStoreService.load(publicKeyHex),
      publicKeyHex,
    );
    maybeEmitBackupRestoreHistoryRegression({
      publicKeyHex,
      stage: "merged_to_applied_store",
      from: mergedPayloadChatDiagnostics,
      to: restoredChatStateDiagnostics,
      restorePath: "full_v1",
      restoreChatStateDomains: true,
    });
  }
  emitApplyCompletionDiagnostics({
    publicKeyHex,
    mergedPayload,
    restorePath: "full_v1",
    summarizeChatStateDiagnostics: summarizePersistedChatStateMessages,
    toPrefixedChatStateDiagnosticsContext,
    parseRoomKeySnapshots,
  });
  saveCommunityMembershipLedger(publicKeyHex, mergedPayload.communityMembershipLedger ?? []);
  await applyRoomKeySnapshots(mergedPayload.roomKeys ?? []);
  PrivacySettingsService.saveSettings(mergedPayload.privacySettings);
  relayListInternals.saveRelayListToStorage(publicKeyHex, mergedPayload.relayList);
  persistUiSettingsSnapshot(profileId, mergedPayload.uiSettings);
};

const applyBackupPayloadNonV1Domains = async (
  publicKeyHex: PublicKeyHex,
  payload: EncryptedAccountBackupPayload,
  profileId = getActiveProfileIdSafe(),
  options?: Readonly<{
    restoreChatStateDomains?: boolean;
    restoreDmChatStateDomains?: boolean;
  }>,
): Promise<void> => {
  const mergedPayload = await mergeIncomingRestorePayload(publicKeyHex, payload, {
    includeHydratedLocalMessages: options?.restoreChatStateDomains === true,
  });
  await persistIdentityUnlockSnapshot({
    publicKeyHex,
    identityUnlock: mergedPayload.identityUnlock,
    profileUsername: mergedPayload.profile.username,
  });
  useProfileInternals.saveToStorage({ profile: mergedPayload.profile });
  useProfileInternals.setState({ profile: mergedPayload.profile });
  useProfileInternals.notify();
  await applyNonV1RestoreMaterialization({
    publicKeyHex,
    mergedPayload,
    profileId,
    options,
    summarizeChatStateDiagnostics: summarizePersistedChatStateMessages,
    buildPrefixedChatStateDiagnosticsContext: toPrefixedChatStateDiagnosticsContext,
    emitRestoreHistoryRegression: maybeEmitBackupRestoreHistoryRegression,
    applyRoomKeySnapshots,
    persistUiSettingsSnapshot,
  });
};

const isRelayPoolWithSubscribe = (pool: RelayPoolLike): pool is RelayPoolWithSubscribe => {
  const candidate = pool as Partial<RelayPoolWithSubscribe>;
  return typeof candidate.sendToOpen === "function"
    && typeof candidate.subscribeToMessages === "function";
};

export const encryptedAccountBackupService = {
  buildBackupPayload,
  async exportPortableAccountBundle(params: Readonly<{
    publicKeyHex: PublicKeyHex;
    privateKeyHex: PrivateKeyHex;
  }>): Promise<Readonly<{
    bundle: PortableAccountBundle;
    backupPayload: EncryptedAccountBackupPayload;
  }>> {
    const backupPayload = await buildBackupPayloadWithHydratedChatState(params.publicKeyHex);
    if (!hasPortablePrivateStateEvidence(backupPayload, hasReplayableChatHistory)) {
      throw new Error("Portable bundle export skipped because private account state is empty.");
    }
    const plaintext = JSON.stringify(backupPayload);
    const ciphertext = await cryptoService.encryptDM(plaintext, params.publicKeyHex, params.privateKeyHex);
    const bundle: PortableAccountBundle = {
      version: 1,
      format: PORTABLE_ACCOUNT_BUNDLE_FORMAT,
      payloadVersion: 1,
      exportedAtUnixMs: Date.now(),
      publicKeyHex: params.publicKeyHex,
      ciphertext,
    };
    emitPortableBundleExport({
      publicKeyHex: params.publicKeyHex,
      payloadCreatedAtUnixMs: backupPayload.createdAtUnixMs,
      exportedAtUnixMs: bundle.exportedAtUnixMs,
      bundleChatDiagnostics: summarizePersistedChatStateMessages(backupPayload.chatState, params.publicKeyHex),
      toPrefixedChatStateDiagnosticsContext,
    });
    return {
      bundle,
      backupPayload,
    };
  },
  async importPortableAccountBundle(params: Readonly<{
    bundle: unknown;
    publicKeyHex: PublicKeyHex;
    privateKeyHex: PrivateKeyHex;
    profileId?: string;
    appendCanonicalEvents?: CanonicalBackupEventAppender;
  }>): Promise<Readonly<{
    bundle: PortableAccountBundle;
    payload: EncryptedAccountBackupPayload;
  }>> {
    const bundle = parsePortableAccountBundle(params.bundle);
    if (!bundle) {
      throw new Error("Portable bundle format is invalid.");
    }
    if (bundle.publicKeyHex !== params.publicKeyHex) {
      throw new Error("Portable bundle belongs to a different account.");
    }

    let plaintext: string;
    try {
      plaintext = await cryptoService.decryptDM(bundle.ciphertext, params.publicKeyHex, params.privateKeyHex);
    } catch {
      throw new Error("Portable bundle could not be decrypted with the active account key.");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(plaintext);
    } catch {
      throw new Error("Portable bundle payload is not valid JSON.");
    }
    const payload = parseBackupPayload(parsedJson);
    if (!payload) {
      throw new Error("Portable bundle payload is invalid.");
    }
    if (payload.publicKeyHex !== params.publicKeyHex) {
      throw new Error("Portable bundle payload public key does not match the active account.");
    }

    const profileId = params.profileId ?? getActiveProfileIdSafe();
    if (params.appendCanonicalEvents) {
      const canonicalEvents = buildCanonicalBackupImportEvents({
        profileId,
        accountPublicKeyHex: params.publicKeyHex,
        payload,
        source: "legacy_bridge",
        idempotencyPrefix: PORTABLE_BUNDLE_IMPORT_IDEMPOTENCY_PREFIX,
      });
      const restoreOwnerSelection = resolveCanonicalBackupRestoreOwnerSelection({
        profileId,
        accountPublicKeyHex: params.publicKeyHex,
      });
      emitBackupRestoreOwnerSelection({
        publicKeyHex: params.publicKeyHex,
        profileId,
        restoreSource: "portable_bundle",
        canonicalEventCount: canonicalEvents.length,
        selection: restoreOwnerSelection,
        payloadDiagnostics: summarizePersistedChatStateMessages(payload.chatState, params.publicKeyHex),
      });
      await applyBackupPayloadNonV1Domains(params.publicKeyHex, payload, profileId, {
        restoreChatStateDomains: true,
        restoreDmChatStateDomains: restoreOwnerSelection.restoreDmChatStateDomains,
      });
      if (canonicalEvents.length > 0) {
        await params.appendCanonicalEvents({
          profileId,
          accountPublicKeyHex: params.publicKeyHex,
          events: canonicalEvents,
        });
      }
    } else {
      await applyBackupPayload(params.publicKeyHex, payload, profileId);
    }

    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      lastEncryptedBackupRestoreAtUnixMs: Date.now(),
      lastRestoreSource: "portable_bundle",
      message: "Portable account bundle imported",
      lastRelayFailureReason: undefined,
    });
    emitPortableBundleImport({
      publicKeyHex: params.publicKeyHex,
      exportedAtUnixMs: bundle.exportedAtUnixMs,
      payloadCreatedAtUnixMs: payload.createdAtUnixMs,
      bundleChatDiagnostics: summarizePersistedChatStateMessages(payload.chatState, params.publicKeyHex),
      toPrefixedChatStateDiagnosticsContext,
    });

    return {
      bundle,
      payload,
    };
  },
  async publishEncryptedAccountBackup(params: Readonly<{
    publicKeyHex: PublicKeyHex;
    privateKeyHex: PrivateKeyHex;
    pool: RelayPoolLike;
    scopedRelayUrls?: ReadonlyArray<string>;
  }>) {
    const localBackupPayload = await buildBackupPayloadWithHydratedChatState(params.publicKeyHex);
    const convergedBackupPayload = await maybeConvergeBackupPayloadBeforePublish({
      localPayload: localBackupPayload,
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      poolAvailable: isRelayPoolWithSubscribe(params.pool),
      summarizeChatStateDiagnostics: summarizePersistedChatStateMessages,
      hasReplayableChatHistory,
      fetchLatestPayload: async ({ publicKeyHex, privateKeyHex }) => (
        encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload({
          publicKeyHex,
          privateKeyHex,
          pool: params.pool as RelayPoolWithSubscribe,
        })
      ),
      mergeForConvergence: ({ localPayload, remotePayload }) => mergeBackupPayloadForPublishConvergence({
        localPayload,
        remotePayload,
        mergeMessageDeleteTombstones,
        toMessageDeleteTombstoneIdSet,
        mergeChatState,
        parseCommunityMembershipLedgerSnapshot,
        reconstructCommunityMembershipFromChatState,
        reconcileIncomingLedgerWithReconstructedJoinedEvidence,
        mergeCommunityMembershipLedgerEntries,
        supplementMembershipLedgerEntries,
        parseRoomKeySnapshots,
        mergeRoomKeySnapshots,
        selectJoinedGroupIds,
        reconstructRoomKeySnapshotsFromChatState,
        mergeIdentityUnlock,
        mergePeerTrust,
        mergeRequestFlowEvidence,
        mergeOutbox,
        mergeCheckpoints,
        mergeRelayList,
      }),
    });
    const backupPayload = convergedBackupPayload.payload;
    const convergenceOutcome = evaluatePublishConvergenceOutcome({
      publicKeyHex: params.publicKeyHex,
      payload: convergedBackupPayload.payload,
      fetchStatus: convergedBackupPayload.fetchStatus,
      floorRequired: convergedBackupPayload.floorRequired,
      remoteHasBackup: convergedBackupPayload.remoteHasBackup,
      localLowEvidence: convergedBackupPayload.localLowEvidence,
      localDiagnostics: convergedBackupPayload.localDiagnostics,
      remoteDiagnostics: convergedBackupPayload.remoteDiagnostics,
      hasReplayableChatHistory,
    });
    if (convergenceOutcome.action === "suppress") {
      return {
        publishResult: {
          status: "unsupported" as const,
          reasonCode: convergenceOutcome.result.reason,
          message: convergenceOutcome.result.message,
        },
        envelope: null,
        backupPayload,
        signedEvent: null,
      };
    }
    if (!hasPortablePrivateStateEvidence(backupPayload, hasReplayableChatHistory)) {
      accountSyncStatusStore.updateSnapshot({
        publicKeyHex: params.publicKeyHex,
        message: "Waiting for private account data before encrypted backup publish",
      });
      return {
        publishResult: {
          status: "unsupported" as const,
          reasonCode: "empty_private_state" as const,
          message: "Skipped encrypted backup publish because private account state is empty.",
        },
        envelope: null,
        backupPayload,
        signedEvent: null,
      };
    }
    const envelope = await buildBackupEnvelope({
      backupPayload,
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      encryptDM: cryptoService.encryptDM.bind(cryptoService),
    });
    const { unsignedEvent, createdAtReservation } = buildBackupUnsignedEvent({
      envelope,
      publicKeyHex: params.publicKeyHex,
      backupPayload,
      reserveCreatedAt: reserveBackupEventCreatedAtUnixSeconds,
      accountBackupEventKind: ACCOUNT_BACKUP_EVENT_KIND,
      accountBackupDTag: ACCOUNT_BACKUP_D_TAG,
      accountBackupCreatedAtMsTag: ACCOUNT_BACKUP_CREATED_AT_MS_TAG,
    });
    const openRelayCount = params.pool.connections.filter((connection) => connection.status === "open").length;
    const configuredRelayCount = (params.scopedRelayUrls && params.scopedRelayUrls.length > 0)
      ? params.scopedRelayUrls.length
      : params.pool.connections.length;
    emitBackupPublishOrdering({
      publicKeyHex: params.publicKeyHex,
      payloadCreatedAtUnixMs: backupPayload.createdAtUnixMs,
      payloadCreatedAtUnixSeconds: createdAtReservation.candidateUnixSeconds,
      eventCreatedAtUnixSeconds: createdAtReservation.createdAtUnixSeconds,
      previousEventCreatedAtUnixSeconds: createdAtReservation.lastUsedUnixSeconds || null,
      createdAtAdjustmentSeconds: (
        createdAtReservation.createdAtUnixSeconds - createdAtReservation.candidateUnixSeconds
      ),
      monotonicBumpApplied: createdAtReservation.monotonicBumpApplied,
      configuredRelayCount,
      openRelayCount,
    });
    const signedEvent = await cryptoService.signEvent(unsignedEvent, params.privateKeyHex);
    const publishResult = await publishViaRelayCore({
      pool: params.pool,
      payload: JSON.stringify(["EVENT", signedEvent]),
      scopedRelayUrls: params.scopedRelayUrls,
      waitForConnectionMs: 2_500,
    });
    const backupDeliveryStatus = mapBackupDeliveryStatus(publishResult);
    accountSyncStatusStore.setBackupProof({
      publicKeyHex: params.publicKeyHex,
      eventId: signedEvent.id,
      deliveryStatus: backupDeliveryStatus,
      successCount: publishResult.value?.successCount,
      totalRelays: publishResult.value?.totalRelays,
      message: publishResult.message,
    });
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      lastEncryptedBackupPublishAtUnixMs: Date.now(),
      hasEncryptedBackup: isBackupPublishSuccessful(publishResult.status),
      lastRelayFailureReason: publishResult.status === "failed" ? publishResult.message : undefined,
    });
    return {
      publishResult,
      envelope,
      backupPayload,
      signedEvent,
    };
  },
  async restoreEncryptedAccountBackup(params: Readonly<{
    publicKeyHex: PublicKeyHex;
    privateKeyHex: PrivateKeyHex;
    pool: RelayPoolWithSubscribe;
    profileId?: string;
    appendCanonicalEvents?: CanonicalBackupEventAppender;
  }>): Promise<AccountBackupFetchResult> {
    const activeProfileIdAtRestoreStart = getActiveProfileIdSafe();
    const fetched = await encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload(params);
    if (!fetched.hasBackup || !fetched.payload) {
      return fetched;
    }
    const requestedProfileId = params.profileId ?? null;
    const activeProfileIdBeforeApply = getActiveProfileIdSafe();
    const profileId = params.profileId ?? activeProfileIdBeforeApply;
    if (params.appendCanonicalEvents) {
      const canonicalEvents = buildCanonicalBackupImportEvents({
        profileId,
        accountPublicKeyHex: params.publicKeyHex,
        payload: fetched.payload,
        source: "relay_sync",
        // Keep canonical import idempotency stable across repeated restores so
        // unchanged backup payloads cannot endlessly append duplicate events.
        idempotencyPrefix: CANONICAL_BACKUP_IMPORT_IDEMPOTENCY_PREFIX,
      });
      const restoreOwnerSelection = resolveCanonicalBackupRestoreOwnerSelection({
        profileId,
        accountPublicKeyHex: params.publicKeyHex,
      });
      emitBackupRestoreOwnerSelection({
        publicKeyHex: params.publicKeyHex,
        profileId,
        restoreSource: "encrypted_backup",
        canonicalEventCount: canonicalEvents.length,
        selection: restoreOwnerSelection,
        payloadDiagnostics: summarizePersistedChatStateMessages(fetched.payload.chatState, params.publicKeyHex),
      });
      await applyBackupPayloadNonV1Domains(params.publicKeyHex, fetched.payload, profileId, {
        restoreChatStateDomains: true,
        restoreDmChatStateDomains: restoreOwnerSelection.restoreDmChatStateDomains,
      });
      const postApplyDiagnostics = summarizePersistedChatStateMessages(
        chatStateStoreService.load(params.publicKeyHex),
        params.publicKeyHex,
      );
      if (canonicalEvents.length > 0) {
        await params.appendCanonicalEvents({
          profileId,
          accountPublicKeyHex: params.publicKeyHex,
          events: canonicalEvents,
        });
        const postCanonicalAppendDiagnostics = summarizePersistedChatStateMessages(
          chatStateStoreService.load(params.publicKeyHex),
          params.publicKeyHex,
        );
        maybeEmitBackupRestoreHistoryRegression({
          publicKeyHex: params.publicKeyHex,
          stage: "post_apply_to_post_canonical_append",
          from: postApplyDiagnostics,
          to: postCanonicalAppendDiagnostics,
          restorePath: "relay_sync_append",
          restoreChatStateDomains: true,
          canonicalEventCount: canonicalEvents.length,
        });
      }
    } else {
      await applyBackupPayload(params.publicKeyHex, fetched.payload, profileId);
    }
    const activeProfileIdAfterApply = getActiveProfileIdSafe();
    maybeEmitBackupRestoreProfileScopeMismatch({
      publicKeyHex: params.publicKeyHex,
      backupEventId: fetched.event?.id ?? null,
      requestedProfileId,
      effectiveProfileId: profileId,
      activeProfileIdAtRestoreStart,
      activeProfileIdBeforeApply,
      activeProfileIdAfterApply,
      hasCanonicalAppender: typeof params.appendCanonicalEvents === "function",
    });
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      hasEncryptedBackup: true,
      lastEncryptedBackupRestoreAtUnixMs: Date.now(),
      latestBackupEventId: fetched.event?.id,
      lastRestoreSource: "encrypted_backup",
    });
    return fetched;
  },
  async fetchLatestEncryptedAccountBackupPayload(params: Readonly<{
    publicKeyHex: PublicKeyHex;
    privateKeyHex: PrivateKeyHex;
    pool: RelayPoolWithSubscribe;
  }>): Promise<AccountBackupFetchResult> {
    const event = await fetchLatestBackupEvent(params.pool, params.publicKeyHex);
    if (!event) {
      accountSyncStatusStore.updateSnapshot({
        publicKeyHex: params.publicKeyHex,
        hasEncryptedBackup: false,
      });
      return {
        event: null,
        payload: null,
        hasBackup: false,
        degradedReason: undefined,
      };
    }
    let plaintext: string;
    try {
      plaintext = await cryptoService.decryptDM(event.content, params.publicKeyHex, params.privateKeyHex);
    } catch (error) {
      const degradedReason = getBackupRestoreErrorMessage(error);
      accountSyncStatusStore.updateSnapshot({
        publicKeyHex: params.publicKeyHex,
        hasEncryptedBackup: true,
        latestBackupEventId: event.id,
        lastRelayFailureReason: degradedReason,
      });
      return {
        event,
        payload: null,
        hasBackup: true,
        degradedReason,
      };
    }
    const payload = parseBackupPayload(JSON.parse(plaintext));
    if (!payload) {
      const degradedReason = "Stored encrypted account backup is invalid.";
      accountSyncStatusStore.updateSnapshot({
        publicKeyHex: params.publicKeyHex,
        hasEncryptedBackup: true,
        latestBackupEventId: event.id,
        lastRelayFailureReason: degradedReason,
      });
      return {
        event,
        payload: null,
        hasBackup: true,
        degradedReason,
      };
    }
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      hasEncryptedBackup: true,
      latestBackupEventId: event.id,
    });
    return {
      event,
      payload,
      hasBackup: true,
      degradedReason: undefined,
    };
  },
};

export const encryptedAccountBackupServiceInternals = {
  applyBackupPayload,
  applyBackupPayloadNonV1Domains,
  mergeIncomingRestorePayload,
  hydrateChatStateFromIndexedMessages,
  fetchLatestBackupEvent,
  getRecoverySnapshotStorageKey,
  isExistingLocalPrivateState,
  mergeChatState,
  mergeCheckpoints,
  mergePersistedMessages,
  mergePersistedGroupMessages,
  mergeOutbox,
  mergePeerTrust,
  mergeRelayList,
  mergeRequestFlowEvidence,
  hasReplayableChatHistory,
  parseBackupPayload,
  buildBackupPayloadWithHydratedChatState,
  compareBackupEvents,
  parseBackupCreatedAtMsTag,
  toPersistedMessageFromIndexedRecord,
  toPersistedGroupMessageFromIndexedRecord,
  resolveCanonicalBackupRestoreOwnerSelection,
  nextBackupEventCreatedAtUnixSeconds,
  resetBackupEventOrderingState: (): void => {
    lastBackupEventCreatedAtByPublicKey.clear();
  },
  fetchLatestEncryptedAccountBackupPayload: encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload,
  toEnvelope,
};
