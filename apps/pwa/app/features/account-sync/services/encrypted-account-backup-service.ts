"use client";

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import type { IdentityRecord } from "@dweb/core/identity-record";
import { MessageQueue } from "@/app/features/messaging/lib/message-queue";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import type { Attachment, PersistedChatState, PersistedGroupMessage, PersistedMessage } from "@/app/features/messaging/types";
import { requestFlowEvidenceStoreInternals } from "@/app/features/messaging/services/request-flow-evidence-store";
import { syncCheckpointInternals } from "@/app/features/messaging/lib/sync-checkpoints";
import { PrivacySettingsService, defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { contactRequestOutboxInternals } from "@/app/features/search/hooks/use-contact-request-outbox";
import type { ContactRequestRecord } from "@/app/features/search/types/discovery";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getActiveProfileIdSafe, getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { publishViaRelayCore, type RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import { messagingDB } from "@dweb/storage/indexed-db";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { extractAttachmentsFromContent } from "@/app/features/messaging/utils/logic";
import { parseCommandMessage } from "@/app/features/messaging/utils/commands";
import {
  loadCommunityMembershipLedger,
  mergeCommunityMembershipLedgerEntries,
  parseCommunityMembershipLedgerSnapshot,
  saveCommunityMembershipLedger,
  selectJoinedCommunityMembershipLedgerEntries,
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
  PortableAccountBundle,
  RelayListSnapshot,
  RequestFlowEvidenceStateSnapshot,
  RoomKeySnapshot,
  StoredPeerTrustSnapshot,
  SyncCheckpointSnapshot,
  UiSettingsSnapshot,
} from "../account-sync-contracts";
import { ACCOUNT_BACKUP_D_TAG, ACCOUNT_BACKUP_EVENT_KIND } from "../account-sync-contracts";
import { accountEventStore } from "./account-event-store";
import { replayAccountEvents } from "./account-event-reducer";

const BACKUP_FETCH_TIMEOUT_MS = 4_000;
const RECOVERY_SNAPSHOT_STORAGE_PREFIX = "obscur.account_sync.recovery_snapshot.v1";
const CANONICAL_BACKUP_IMPORT_IDEMPOTENCY_PREFIX = "backup_restore_v1";
const PORTABLE_ACCOUNT_BUNDLE_FORMAT: PortableAccountBundle["format"] = "obscur.portable_account_bundle.v1";
const PORTABLE_BUNDLE_IMPORT_IDEMPOTENCY_PREFIX = "portable_bundle_import_v1";
const ACCOUNT_BACKUP_CREATED_AT_MS_TAG = "obscur_backup_created_at_ms";
const INDEXED_MESSAGE_BACKUP_SCAN_LIMIT = 2_000;
const MESSAGE_QUEUE_BACKUP_SCAN_LIMIT = 2_000;
const INDEXED_DB_READ_TIMEOUT_MS = 750;
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
    logAppEvent({
      name: "account_sync.identity_unlock_conflict_preserved_local",
      level: "warn",
      scope: { feature: "account_sync", action: "backup_restore" },
      context: {
        localUsernamePresent: typeof current.username === "string" && current.username.trim().length > 0,
        incomingUsernamePresent: typeof incoming.username === "string" && incoming.username.trim().length > 0,
      },
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

type BackupSelectionSource = "pool" | "direct" | "none";

type BackupSelectionDiagnostics = Readonly<{
  source: BackupSelectionSource;
  publicKeyHex: PublicKeyHex;
  selectedEvent: NostrEvent | null;
  poolOpenRelayCount: number;
  poolExpectedEoseRelayCount: number;
  poolReceivedEoseRelayCount: number;
  poolCandidateCount: number;
  poolTimedOut: boolean;
  fallbackRelayCount: number;
}>;

type BackupRestoreProfileScopeMismatchReasonCode =
  | "requested_profile_not_active"
  | "active_profile_changed_during_restore"
  | "active_profile_changed_after_apply";

type BackupRestoreProfileScopeDiagnostics = Readonly<{
  publicKeyHex: PublicKeyHex;
  backupEventId: string | null;
  requestedProfileId: string | null;
  effectiveProfileId: string;
  activeProfileIdAtRestoreStart: string;
  activeProfileIdBeforeApply: string;
  activeProfileIdAfterApply: string;
  hasCanonicalAppender: boolean;
}>;

const resolveBackupRestoreProfileScopeMismatchReasonCode = (
  params: BackupRestoreProfileScopeDiagnostics,
): BackupRestoreProfileScopeMismatchReasonCode | null => {
  if (params.requestedProfileId && params.requestedProfileId !== params.activeProfileIdBeforeApply) {
    return "requested_profile_not_active";
  }
  if (params.activeProfileIdBeforeApply !== params.activeProfileIdAtRestoreStart) {
    return "active_profile_changed_during_restore";
  }
  if (params.activeProfileIdAfterApply !== params.activeProfileIdBeforeApply) {
    return "active_profile_changed_after_apply";
  }
  return null;
};

const maybeEmitBackupRestoreProfileScopeMismatch = (
  params: BackupRestoreProfileScopeDiagnostics,
): void => {
  const reasonCode = resolveBackupRestoreProfileScopeMismatchReasonCode(params);
  if (!reasonCode) {
    return;
  }
  logAppEvent({
    name: "account_sync.backup_restore_profile_scope_mismatch",
    level: "warn",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      reasonCode,
      publicKeySuffix: params.publicKeyHex.slice(-8),
      backupEventId: params.backupEventId,
      requestedProfileId: params.requestedProfileId,
      effectiveProfileId: params.effectiveProfileId,
      activeProfileIdAtRestoreStart: params.activeProfileIdAtRestoreStart,
      activeProfileIdBeforeApply: params.activeProfileIdBeforeApply,
      activeProfileIdAfterApply: params.activeProfileIdAfterApply,
      hasCanonicalAppender: params.hasCanonicalAppender,
    },
  });
};

const emitBackupRestoreSelectionDiagnostics = (params: BackupSelectionDiagnostics): void => {
  const selectedPayloadCreatedAtUnixMs = params.selectedEvent
    ? parseBackupCreatedAtMsTag(params.selectedEvent)
    : null;
  logAppEvent({
    name: "account_sync.backup_restore_selection",
    level: "info",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      source: params.source,
      selectionComparator: "payload_ms_then_created_at_then_event_id",
      publicKeySuffix: params.publicKeyHex.slice(-8),
      poolOpenRelayCount: params.poolOpenRelayCount,
      poolExpectedEoseRelayCount: params.poolExpectedEoseRelayCount,
      poolReceivedEoseRelayCount: params.poolReceivedEoseRelayCount,
      poolCandidateCount: params.poolCandidateCount,
      poolTimedOut: params.poolTimedOut,
      fallbackRelayCount: params.fallbackRelayCount,
      selectedEventId: params.selectedEvent?.id ?? null,
      selectedEventCreatedAtUnixSeconds: params.selectedEvent?.created_at ?? null,
      selectedPayloadCreatedAtUnixMs,
    },
  });
};

const uniqueStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> => Array.from(new Set(values.filter((value) => value.length > 0)));
const PLACEHOLDER_GROUP_DISPLAY_NAME = "Private Group";
const HASHED_COMMUNITY_ID_PATTERN = /^v2_[0-9a-f]{64}$/i;

const hasMeaningfulGroupDisplayName = (value: string | undefined): boolean => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 && trimmed !== PLACEHOLDER_GROUP_DISPLAY_NAME;
};

const pickPreferredGroupDisplayName = (
  newerName: string | undefined,
  olderName: string | undefined,
): string => {
  if (hasMeaningfulGroupDisplayName(newerName)) {
    return (newerName ?? "").trim();
  }
  if (hasMeaningfulGroupDisplayName(olderName)) {
    return (olderName ?? "").trim();
  }
  const fallback = (newerName ?? "").trim() || (olderName ?? "").trim();
  return fallback.length > 0 ? fallback : PLACEHOLDER_GROUP_DISPLAY_NAME;
};

const isHashedCommunityId = (value: string | undefined): boolean => {
  const trimmed = value?.trim() ?? "";
  return HASHED_COMMUNITY_ID_PATTERN.test(trimmed);
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

const toPreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 140)}...`;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timeout"));
    }, timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
};

const resolveDeleteCommandTargetMessageId = (message: Readonly<{
  content?: unknown;
}>): string | null => {
  if (typeof message.content !== "string") {
    return null;
  }
  const parsedCommand = parseCommandMessage(message.content);
  if (!parsedCommand || parsedCommand.type !== "delete") {
    return null;
  }
  const targetMessageId = parsedCommand.targetMessageId.trim();
  return targetMessageId.length > 0 ? targetMessageId : null;
};

const isCommandDmMessage = (message: Readonly<{
  kind?: unknown;
  content?: unknown;
}>): boolean => (
  message.kind === "command"
  || resolveDeleteCommandTargetMessageId(message) !== null
);

const toPersistedMessageIdentityKeys = (message: Readonly<{
  id?: unknown;
  eventId?: unknown;
}>): ReadonlyArray<string> => {
  const keys = new Set<string>();
  const id = typeof message.id === "string" ? message.id.trim() : "";
  const eventId = typeof message.eventId === "string" ? message.eventId.trim() : "";
  if (id.length > 0) {
    keys.add(id);
  }
  if (eventId.length > 0) {
    keys.add(eventId);
  }
  return Array.from(keys);
};

const sanitizePersistedMessagesByDeleteContract = (
  messages: ReadonlyArray<PersistedMessage>,
): ReadonlyArray<PersistedMessage> => {
  if (messages.length === 0) {
    return messages;
  }
  const deleteTargetMessageIds = new Set<string>();
  const commandMessageIds = new Set<string>();
  messages.forEach((message) => {
    const messageId = typeof message.id === "string" ? message.id.trim() : "";
    if (messageId.length > 0 && isCommandDmMessage(message)) {
      commandMessageIds.add(messageId);
    }
    const targetMessageId = resolveDeleteCommandTargetMessageId(message);
    if (targetMessageId) {
      deleteTargetMessageIds.add(targetMessageId);
    }
  });
  if (deleteTargetMessageIds.size > 0) {
    const knownIdentityKeys = new Set<string>();
    messages.forEach((message) => {
      toPersistedMessageIdentityKeys(message).forEach((identityKey) => {
        knownIdentityKeys.add(identityKey);
      });
    });
    const unresolvedTargets = Array.from(deleteTargetMessageIds).filter((targetMessageId) => !knownIdentityKeys.has(targetMessageId));
    if (unresolvedTargets.length > 0) {
      logAppEvent({
        name: "account_sync.backup_restore_delete_target_unresolved",
        level: "warn",
        scope: { feature: "account_sync", action: "backup_restore" },
        context: {
          messageCount: messages.length,
          commandMessageCount: commandMessageIds.size,
          deleteTargetCount: deleteTargetMessageIds.size,
          unresolvedDeleteTargetCount: unresolvedTargets.length,
          unresolvedDeleteTargetSample: unresolvedTargets.slice(0, 5).join(","),
        },
      });
    }
  }
  const filtered = messages.filter((message) => {
    const identityKeys = toPersistedMessageIdentityKeys(message);
    if (identityKeys.length === 0) {
      return false;
    }
    if (identityKeys.some((identityKey) => deleteTargetMessageIds.has(identityKey))) {
      return false;
    }
    return !isCommandDmMessage(message);
  });
  if (filtered.length <= 1) {
    return filtered;
  }
  return filtered.slice().sort((left, right) => Number(left.timestampMs ?? 0) - Number(right.timestampMs ?? 0));
};

const sanitizePersistedChatStateMessagesByDeleteContract = (
  chatState: EncryptedAccountBackupPayload["chatState"],
): EncryptedAccountBackupPayload["chatState"] => {
  if (!chatState) {
    return chatState;
  }

  const sanitizedMessagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {};
  Object.entries(chatState.messagesByConversationId ?? {}).forEach(([conversationId, messages]) => {
    const sanitizedMessages = sanitizePersistedMessagesByDeleteContract(messages ?? []);
    if (sanitizedMessages.length > 0) {
      sanitizedMessagesByConversationId[conversationId] = sanitizedMessages;
    }
  });

  const latestMessageByConversationId = new Map<string, PersistedMessage>();
  Object.entries(sanitizedMessagesByConversationId).forEach(([conversationId, messages]) => {
    const latest = messages[messages.length - 1];
    if (latest) {
      latestMessageByConversationId.set(conversationId, latest);
    }
  });

  const sanitizedCreatedConnections = chatState.createdConnections.map((connection) => {
    const latestMessage = latestMessageByConversationId.get(connection.id);
    const parsedCommandPreview = parseCommandMessage(connection.lastMessage ?? "");
    if (!latestMessage) {
      if (!parsedCommandPreview) {
        return connection;
      }
      return {
        ...connection,
        lastMessage: "",
        lastMessageTimeMs: 0,
      };
    }
    if (!parsedCommandPreview && latestMessage.timestampMs < connection.lastMessageTimeMs) {
      return connection;
    }
    return {
      ...connection,
      lastMessage: toPreview(latestMessage.content ?? ""),
      lastMessageTimeMs: latestMessage.timestampMs,
    };
  });

  return {
    ...chatState,
    createdConnections: sanitizedCreatedConnections,
    messagesByConversationId: sanitizedMessagesByConversationId,
  };
};

const getPersistedMessageCount = (value: EncryptedAccountBackupPayload["chatState"]): number => {
  if (!value) {
    return 0;
  }
  return Object.values(value.messagesByConversationId).reduce((sum, messages) => sum + messages.length, 0);
};

const getPersistedGroupMessageCount = (value: EncryptedAccountBackupPayload["chatState"]): number => {
  if (!value) {
    return 0;
  }
  return Object.values(value.groupMessages ?? {}).reduce((sum, messages) => sum + messages.length, 0);
};

const getPersistedOutgoingMessageCount = (
  value: EncryptedAccountBackupPayload["chatState"],
  publicKeyHex: PublicKeyHex
): number => {
  if (!value) {
    return 0;
  }
  return Object.values(value.messagesByConversationId).reduce((sum, messages) => {
    const outgoingCount = messages.filter((message) => (
      message.isOutgoing === true
      || normalizePublicKeyHex(message.pubkey) === publicKeyHex
    )).length;
    return sum + outgoingCount;
  }, 0);
};

const hasReplayableChatHistory = (value: EncryptedAccountBackupPayload["chatState"]): boolean => (
  getPersistedMessageCount(value) > 0 || getPersistedGroupMessageCount(value) > 0
);

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

const hasAcceptedRequestFlowEvidence = (snapshot: RequestFlowEvidenceStateSnapshot): boolean => (
  Object.values(snapshot.byPeer).some((evidence) => evidence.acceptSeen)
);

const hasAcceptedConnectionRequest = (value: EncryptedAccountBackupPayload["chatState"]): boolean => (
  Boolean(value?.connectionRequests?.some((request) => request.status === "accepted"))
);

const hasPortablePrivateStateEvidence = (payload: EncryptedAccountBackupPayload): boolean => {
  const joinedCommunityCount = selectJoinedCommunityMembershipLedgerEntries(payload.communityMembershipLedger ?? []).length;
  const roomKeyCount = parseRoomKeySnapshots(payload.roomKeys).length;
  const hasDurableAcceptanceState = payload.peerTrust.acceptedPeers.length > 0
    || hasAcceptedRequestFlowEvidence(payload.requestFlowEvidence)
    || (payload.chatState?.createdConnections.length ?? 0) > 0
    || (payload.chatState?.createdGroups.length ?? 0) > 0
    || joinedCommunityCount > 0
    || hasAcceptedConnectionRequest(payload.chatState)
    || roomKeyCount > 0;
  return payload.peerTrust.mutedPeers.length > 0
    || hasDurableAcceptanceState
    || hasReplayableChatHistory(payload.chatState);
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

const pickNewestBy = <T extends Record<string, unknown>>(
  values: ReadonlyArray<T>,
  getKey: (value: T) => string,
  getUpdatedAt: (value: T) => number
): ReadonlyArray<T> => {
  const map = new Map<string, T>();
  for (const value of values) {
    const key = getKey(value);
    const current = map.get(key);
    if (!current || getUpdatedAt(value) >= getUpdatedAt(current)) {
      map.set(key, value);
    }
  }
  return Array.from(map.values());
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

const mergePersistedAttachments = (
  current: ReadonlyArray<Attachment> | undefined,
  incoming: ReadonlyArray<Attachment> | undefined,
): ReadonlyArray<Attachment> | undefined => {
  const currentList = current ?? [];
  const incomingList = incoming ?? [];
  if (currentList.length === 0 && incomingList.length === 0) {
    return undefined;
  }
  const byUrl = new Map<string, Attachment>();
  [...currentList, ...incomingList].forEach((attachment) => {
    const url = attachment.url?.trim();
    if (!url) {
      return;
    }
    byUrl.set(url, {
      ...attachment,
      url,
    });
  });
  return Array.from(byUrl.values());
};

const mergePersistedMessageEntry = (
  left: PersistedMessage,
  right: PersistedMessage,
): PersistedMessage => {
  const rightIsNewer = Number(right.timestampMs ?? 0) >= Number(left.timestampMs ?? 0);
  const primary = rightIsNewer ? right : left;
  const secondary = rightIsNewer ? left : right;
  const mergedAttachments = mergePersistedAttachments(secondary.attachments, primary.attachments);
  return {
    ...secondary,
    ...primary,
    ...(mergedAttachments && mergedAttachments.length > 0 ? { attachments: mergedAttachments } : {}),
  };
};

const mergePersistedMessages = (
  current: ReadonlyArray<PersistedMessage>,
  incoming: ReadonlyArray<PersistedMessage>,
): ReadonlyArray<PersistedMessage> => {
  const byCanonicalIdentity = new Map<string, PersistedMessage>();
  const canonicalIdentityByAlias = new Map<string, string>();
  for (const message of [...current, ...incoming]) {
    const identityKeys = toPersistedMessageIdentityKeys(message);
    if (identityKeys.length === 0) {
      continue;
    }
    const existingCanonicalIdentity = identityKeys.reduce<string | null>((resolved, identityKey) => {
      if (resolved) {
        return resolved;
      }
      return canonicalIdentityByAlias.get(identityKey) ?? null;
    }, null);
    const canonicalIdentity = existingCanonicalIdentity ?? identityKeys[0];
    const existing = byCanonicalIdentity.get(canonicalIdentity);
    const merged = existing
      ? mergePersistedMessageEntry(existing, message)
      : message;

    const mergedIdentityKeys = toPersistedMessageIdentityKeys(merged);
    mergedIdentityKeys.forEach((identityKey) => {
      canonicalIdentityByAlias.set(identityKey, canonicalIdentity);
    });
    identityKeys.forEach((identityKey) => {
      canonicalIdentityByAlias.set(identityKey, canonicalIdentity);
    });

    if (!existing) {
      byCanonicalIdentity.set(canonicalIdentity, merged);
      continue;
    }
    byCanonicalIdentity.set(canonicalIdentity, merged);
  }
  return Array.from(byCanonicalIdentity.values()).sort((a, b) => Number(a.timestampMs ?? 0) - Number(b.timestampMs ?? 0));
};

const mergePersistedGroupMessages = (
  current: ReadonlyArray<PersistedGroupMessage>,
  incoming: ReadonlyArray<PersistedGroupMessage>,
): ReadonlyArray<PersistedGroupMessage> => {
  const byId = new Map<string, PersistedGroupMessage>();
  for (const message of [...current, ...incoming]) {
    const key = message.id;
    if (!key) {
      continue;
    }
    const existing = byId.get(key);
    if (!existing || Number(message.created_at ?? 0) >= Number(existing.created_at ?? 0)) {
      byId.set(key, message);
    }
  }
  return Array.from(byId.values()).sort((a, b) => Number(a.created_at ?? 0) - Number(b.created_at ?? 0));
};

const mergeMessageMaps = (
  current: PersistedChatState["messagesByConversationId"],
  incoming: PersistedChatState["messagesByConversationId"],
): PersistedChatState["messagesByConversationId"] => {
  const merged: Record<string, ReadonlyArray<PersistedMessage>> = {};
  const keys = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  keys.forEach((conversationId) => {
    const currentMessages = current[conversationId] ?? [];
    const incomingMessages = incoming[conversationId] ?? [];
    merged[conversationId] = mergePersistedMessages(currentMessages, incomingMessages);
  });
  return merged;
};

const mergeGroupMessageMaps = (
  current: PersistedChatState["groupMessages"] | undefined,
  incoming: PersistedChatState["groupMessages"] | undefined,
): PersistedChatState["groupMessages"] => {
  const currentMap = current ?? {};
  const incomingMap = incoming ?? {};
  const merged: Record<string, ReadonlyArray<PersistedGroupMessage>> = {};
  const keys = new Set([...Object.keys(currentMap), ...Object.keys(incomingMap)]);
  keys.forEach((conversationId) => {
    const currentMessages = currentMap[conversationId] ?? [];
    const incomingMessages = incomingMap[conversationId] ?? [];
    merged[conversationId] = mergePersistedGroupMessages(currentMessages, incomingMessages);
  });
  return merged;
};

const toPersistedGroupMergeKey = (group: PersistedChatState["createdGroups"][number]): string => {
  const groupId = String(group.groupId ?? "").trim();
  const relayUrl = String(group.relayUrl ?? "").trim();
  if (groupId.length > 0 && relayUrl.length > 0) {
    return `${groupId}@@${relayUrl}`;
  }
  return String(group.id ?? "").trim();
};

const mergePersistedGroupConversations = (
  current: PersistedChatState["createdGroups"],
  incoming: PersistedChatState["createdGroups"],
): PersistedChatState["createdGroups"] => {
  const byKey = new Map<string, PersistedChatState["createdGroups"][number]>();

  const mergeEntry = (
    left: PersistedChatState["createdGroups"][number],
    right: PersistedChatState["createdGroups"][number],
  ): PersistedChatState["createdGroups"][number] => {
    const rightIsNewer = Number(right.lastMessageTimeMs ?? 0) >= Number(left.lastMessageTimeMs ?? 0);
    const newer = rightIsNewer ? right : left;
    const older = rightIsNewer ? left : right;

    const mergedGroupId = String(newer.groupId ?? older.groupId ?? "").trim();
    const mergedRelayUrl = String(newer.relayUrl ?? older.relayUrl ?? "").trim();
    const mergedCommunityIdCandidate = (
      isHashedCommunityId(newer.communityId)
        ? newer.communityId
        : isHashedCommunityId(older.communityId)
          ? older.communityId
          : (newer.communityId ?? "").trim() || (older.communityId ?? "").trim() || undefined
    );
    const mergedGenesisEventId = newer.genesisEventId ?? older.genesisEventId;
    const mergedCreatorPubkey = newer.creatorPubkey ?? older.creatorPubkey;

    const mergedMemberPubkeys = uniqueStrings([
      ...(left.memberPubkeys ?? []),
      ...(right.memberPubkeys ?? []),
      ...(left.creatorPubkey ? [left.creatorPubkey] : []),
      ...(right.creatorPubkey ? [right.creatorPubkey] : []),
    ]);
    const mergedAdminPubkeys = uniqueStrings([
      ...(left.adminPubkeys ?? []),
      ...(right.adminPubkeys ?? []),
    ]);
    const mergedConversationId = (mergedGroupId.length > 0 && mergedRelayUrl.length > 0)
      ? toGroupConversationId({
        groupId: mergedGroupId,
        relayUrl: mergedRelayUrl,
        communityId: mergedCommunityIdCandidate,
        genesisEventId: mergedGenesisEventId,
        creatorPubkey: mergedCreatorPubkey,
      })
      : (newer.id || older.id);

    const newerAvatar = newer.avatar?.trim();
    const olderAvatar = older.avatar?.trim();
    const newerAbout = newer.about?.trim();
    const olderAbout = older.about?.trim();

    return {
      ...older,
      ...newer,
      id: mergedConversationId,
      groupId: mergedGroupId,
      relayUrl: mergedRelayUrl,
      communityId: mergedCommunityIdCandidate,
      genesisEventId: mergedGenesisEventId,
      creatorPubkey: mergedCreatorPubkey,
      displayName: pickPreferredGroupDisplayName(newer.displayName, older.displayName),
      memberPubkeys: mergedMemberPubkeys,
      adminPubkeys: mergedAdminPubkeys,
      memberCount: Math.max(
        left.memberCount ?? 0,
        right.memberCount ?? 0,
        mergedMemberPubkeys.length,
      ),
      lastMessage: (newer.lastMessage ?? "").trim().length > 0
        ? newer.lastMessage
        : older.lastMessage,
      avatar: newerAvatar && newerAvatar.length > 0
        ? newerAvatar
        : olderAvatar && olderAvatar.length > 0
          ? olderAvatar
          : undefined,
      about: newerAbout && newerAbout.length > 0
        ? newerAbout
        : olderAbout && olderAbout.length > 0
          ? olderAbout
          : undefined,
    };
  };

  for (const group of [...current, ...incoming]) {
    const key = toPersistedGroupMergeKey(group);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, group);
      continue;
    }
    byKey.set(key, mergeEntry(existing, group));
  }

  return Array.from(byKey.values());
};

const mergeChatState = (
  current: EncryptedAccountBackupPayload["chatState"],
  incoming: EncryptedAccountBackupPayload["chatState"]
): EncryptedAccountBackupPayload["chatState"] => {
  if (!current) {
    return sanitizePersistedChatStateMessagesByDeleteContract(incoming);
  }
  if (!incoming) {
    return sanitizePersistedChatStateMessagesByDeleteContract(current);
  }
  return sanitizePersistedChatStateMessagesByDeleteContract({
    ...incoming,
    createdConnections: pickNewestBy(
      [...current.createdConnections, ...incoming.createdConnections],
      (value) => String(value.id ?? ""),
      (value) => Number(value.lastMessageTimeMs ?? 0)
    ),
    createdGroups: mergePersistedGroupConversations(
      current.createdGroups,
      incoming.createdGroups,
    ),
    connectionRequests: pickNewestBy(
      [...(current.connectionRequests ?? []), ...(incoming.connectionRequests ?? [])],
      (value) => String(value.id ?? ""),
      (value) => Number(value.timestampMs ?? 0)
    ),
    pinnedChatIds: uniqueStrings([...(current.pinnedChatIds ?? []), ...(incoming.pinnedChatIds ?? [])]),
    hiddenChatIds: uniqueStrings([...(current.hiddenChatIds ?? []), ...(incoming.hiddenChatIds ?? [])]),
    unreadByConversationId: {
      ...current.unreadByConversationId,
      ...incoming.unreadByConversationId,
    },
    connectionOverridesByConnectionId: {
      ...current.connectionOverridesByConnectionId,
      ...incoming.connectionOverridesByConnectionId,
    },
    messagesByConversationId: mergeMessageMaps(
      current.messagesByConversationId,
      incoming.messagesByConversationId,
    ),
    groupMessages: mergeGroupMessageMaps(current.groupMessages, incoming.groupMessages),
  });
};

const normalizeMessageStatus = (value: unknown): PersistedMessage["status"] => {
  switch (value) {
    case "delivered":
    case "sending":
    case "accepted":
    case "rejected":
    case "queued":
    case "failed":
      return value;
    default:
      return "delivered";
  }
};

const toTimestampMs = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const unixMs = value.getTime();
    return Number.isFinite(unixMs) ? unixMs : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    const dateValue = new Date(value).getTime();
    return Number.isFinite(dateValue) ? dateValue : null;
  }
  return null;
};

const inferPeerFromConversationId = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
  const directPeer = normalizePublicKeyHex(params.conversationId);
  if (directPeer && directPeer !== params.myPublicKeyHex) {
    return directPeer;
  }
  const parts = params.conversationId.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const left = normalizePublicKeyHex(parts[0]);
  const right = normalizePublicKeyHex(parts[1]);
  if (!left || !right) {
    return null;
  }
  if (left === params.myPublicKeyHex && right !== params.myPublicKeyHex) {
    return right;
  }
  if (right === params.myPublicKeyHex && left !== params.myPublicKeyHex) {
    return left;
  }
  return null;
};

const isLikelyGroupConversationId = (conversationId: string): boolean => {
  const trimmed = conversationId.trim();
  return trimmed.startsWith("community:") || trimmed.startsWith("group:") || trimmed.includes("@");
};

const toPersistedGroupMessageFromIndexedRecord = (params: Readonly<{
  record: Readonly<Record<string, unknown>>;
  myPublicKeyHex: PublicKeyHex;
}>): Readonly<{
  conversationId: string;
  persistedMessage: PersistedGroupMessage;
}> | null => {
  const conversationIdRaw = params.record.conversationId;
  if (typeof conversationIdRaw !== "string") {
    return null;
  }
  const conversationId = conversationIdRaw.trim();
  if (!conversationId || !isLikelyGroupConversationId(conversationId)) {
    return null;
  }

  const idRaw = params.record.id;
  const eventIdRaw = params.record.eventId;
  const normalizedEventId = typeof eventIdRaw === "string" && eventIdRaw.trim().length > 0
    ? eventIdRaw.trim()
    : null;
  const normalizedId = typeof idRaw === "string" && idRaw.trim().length > 0
    ? idRaw.trim()
    : null;
  const messageId = normalizedEventId ?? normalizedId;
  if (!messageId) {
    return null;
  }

  const timestampMs = toTimestampMs(params.record.timestampMs)
    ?? toTimestampMs(params.record.timestamp)
    ?? toTimestampMs(params.record.eventCreatedAt)
    ?? Date.now();
  const createdAtUnixSeconds = Math.max(0, Math.floor(timestampMs / 1000));

  const senderPubkey = normalizePublicKeyHex(
    typeof params.record.senderPubkey === "string" ? params.record.senderPubkey : undefined
  ) ?? normalizePublicKeyHex(
    typeof params.record.pubkey === "string" ? params.record.pubkey : undefined
  ) ?? (
    params.record.isOutgoing === true ? params.myPublicKeyHex : null
  );
  if (!senderPubkey) {
    return null;
  }

  const content = typeof params.record.content === "string"
    ? params.record.content
    : "";

  return {
    conversationId,
    persistedMessage: {
      id: messageId,
      pubkey: senderPubkey,
      content,
      created_at: createdAtUnixSeconds,
    },
  };
};

const toAttachmentKind = (value: unknown): Attachment["kind"] | null => {
  if (value === "image" || value === "video" || value === "audio" || value === "voice_note" || value === "file") {
    return value;
  }
  return null;
};

const parseAttachmentCandidate = (value: unknown): Attachment | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<Attachment>;
  const kind = toAttachmentKind(candidate.kind);
  const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
  const contentType = typeof candidate.contentType === "string" ? candidate.contentType.trim() : "";
  const fileName = typeof candidate.fileName === "string" ? candidate.fileName.trim() : "";
  if (!kind || !url || !contentType || !fileName) {
    return null;
  }
  return {
    kind,
    url,
    contentType,
    fileName,
  };
};

const dedupeAttachments = (attachments: ReadonlyArray<Attachment>): ReadonlyArray<Attachment> => {
  if (attachments.length <= 1) {
    return attachments;
  }
  const byUrl = new Map<string, Attachment>();
  attachments.forEach((attachment) => {
    const url = attachment.url.trim();
    if (!url || byUrl.has(url)) {
      return;
    }
    byUrl.set(url, {
      ...attachment,
      url,
    });
  });
  return Array.from(byUrl.values());
};

const extractPersistedAttachmentsFromRecord = (
  record: Readonly<Record<string, unknown>>,
  content: string,
): ReadonlyArray<Attachment> => {
  const fromArray = Array.isArray(record.attachments)
    ? record.attachments
      .map((value) => parseAttachmentCandidate(value))
      .filter((value): value is Attachment => value !== null)
    : [];
  const fromLegacySingle = parseAttachmentCandidate(record.attachment);
  const fromRecord = dedupeAttachments([
    ...fromArray,
    ...(fromLegacySingle ? [fromLegacySingle] : []),
  ]);
  if (fromRecord.length > 0) {
    return fromRecord;
  }
  return dedupeAttachments(extractAttachmentsFromContent(content));
};

const resolveDmRecordDirection = (params: Readonly<{
  record: Readonly<Record<string, unknown>>;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): Readonly<{
  isOutgoing: boolean;
  senderPubkey: PublicKeyHex | null;
  recipientPubkey: PublicKeyHex | null;
  peerPublicKeyHex: PublicKeyHex | null;
}> => {
  const senderPubkeyFromRecord = normalizePublicKeyHex(
    typeof params.record.senderPubkey === "string" ? params.record.senderPubkey : undefined
  ) ?? normalizePublicKeyHex(
    typeof params.record.pubkey === "string" ? params.record.pubkey : undefined
  );
  const recipientPubkey = normalizePublicKeyHex(
    typeof params.record.recipientPubkey === "string" ? params.record.recipientPubkey : undefined
  );
  const inferredPeerPublicKeyHex = inferPeerFromConversationId({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });

  let isOutgoing = typeof params.record.isOutgoing === "boolean"
    ? params.record.isOutgoing
    : false;
  let peerPublicKeyHex: PublicKeyHex | null = null;

  if (
    senderPubkeyFromRecord === params.myPublicKeyHex
    && recipientPubkey
    && recipientPubkey !== params.myPublicKeyHex
  ) {
    isOutgoing = true;
    peerPublicKeyHex = recipientPubkey;
  } else if (senderPubkeyFromRecord === params.myPublicKeyHex) {
    isOutgoing = true;
    peerPublicKeyHex = inferredPeerPublicKeyHex;
  } else if (
    recipientPubkey === params.myPublicKeyHex
    && senderPubkeyFromRecord
    && senderPubkeyFromRecord !== params.myPublicKeyHex
  ) {
    isOutgoing = false;
    peerPublicKeyHex = senderPubkeyFromRecord;
  } else if (
    !senderPubkeyFromRecord
    && recipientPubkey
    && recipientPubkey !== params.myPublicKeyHex
    && inferredPeerPublicKeyHex
    && recipientPubkey === inferredPeerPublicKeyHex
  ) {
    // Legacy records can omit senderPubkey/isOutgoing while still carrying
    // recipient and canonical conversation context.
    isOutgoing = true;
    peerPublicKeyHex = recipientPubkey;
  } else {
    peerPublicKeyHex = inferredPeerPublicKeyHex;
  }

  const senderPubkey = senderPubkeyFromRecord ?? (
    isOutgoing
      ? params.myPublicKeyHex
      : peerPublicKeyHex
  );

  return {
    isOutgoing,
    senderPubkey,
    recipientPubkey,
    peerPublicKeyHex,
  };
};

const toPersistedMessageFromIndexedRecord = (params: Readonly<{
  record: Readonly<Record<string, unknown>>;
  myPublicKeyHex: PublicKeyHex;
}>): Readonly<{
  conversationId: string;
  persistedMessage: PersistedMessage;
  peerPublicKeyHex: PublicKeyHex | null;
}> | null => {
  const conversationIdRaw = params.record.conversationId;
  if (typeof conversationIdRaw !== "string") {
    return null;
  }
  const conversationId = conversationIdRaw.trim();
  if (conversationId.length === 0) {
    return null;
  }

  const idRaw = params.record.id;
  const eventIdRaw = params.record.eventId;
  const normalizedEventId = typeof eventIdRaw === "string" && eventIdRaw.trim().length > 0
    ? eventIdRaw.trim()
    : null;
  const normalizedId = typeof idRaw === "string" && idRaw.trim().length > 0
    ? idRaw.trim()
    : null;
  const messageId = normalizedEventId ?? normalizedId;
  if (!messageId) {
    return null;
  }

  const timestampMs = toTimestampMs(params.record.timestampMs)
    ?? toTimestampMs(params.record.timestamp)
    ?? toTimestampMs(params.record.eventCreatedAt)
    ?? Date.now();
  const { isOutgoing, senderPubkey, peerPublicKeyHex } = resolveDmRecordDirection({
    record: params.record,
    conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });

  const content = typeof params.record.content === "string"
    ? params.record.content
    : "";
  const attachments = extractPersistedAttachmentsFromRecord(params.record, content);

  const kind = params.record.kind === "command" ? "command" : undefined;

  return {
    conversationId,
    persistedMessage: {
      id: messageId,
      ...(normalizedEventId ? { eventId: normalizedEventId } : {}),
      ...(kind ? { kind } : {}),
      ...(senderPubkey ? { pubkey: senderPubkey } : {}),
      content,
      timestampMs,
      isOutgoing,
      status: normalizeMessageStatus(params.record.status),
      ...(attachments.length > 0 ? { attachments } : {}),
    },
    peerPublicKeyHex,
  };
};

const loadMessageQueueRecords = async (
  publicKeyHex: PublicKeyHex
): Promise<ReadonlyArray<Readonly<Record<string, unknown>>>> => {
  try {
    const messageQueue = new MessageQueue(publicKeyHex);
    const messages = await withTimeout(
      messageQueue.getAllMessages(MESSAGE_QUEUE_BACKUP_SCAN_LIMIT),
      INDEXED_DB_READ_TIMEOUT_MS,
    );
    return messages as unknown as ReadonlyArray<Readonly<Record<string, unknown>>>;
  } catch {
    return [];
  }
};

const loadIndexedMessageRecords = async (): Promise<ReadonlyArray<Readonly<Record<string, unknown>>>> => {
  try {
    return await withTimeout(
      messagingDB.getAllByIndex<Readonly<Record<string, unknown>>>(
        "messages",
        "timestampMs",
        undefined,
        INDEXED_MESSAGE_BACKUP_SCAN_LIMIT,
        "prev",
      ),
      INDEXED_DB_READ_TIMEOUT_MS,
    );
  } catch {
    // Fallback for legacy environments/tests without index support.
    try {
      return await withTimeout(
        messagingDB.getAll<Readonly<Record<string, unknown>>>("messages"),
        INDEXED_DB_READ_TIMEOUT_MS,
      );
    } catch {
      return [];
    }
  }
};

const hasOutgoingMessageEvidence = (
  record: Readonly<Record<string, unknown>>,
  myPublicKeyHex: PublicKeyHex
): boolean => {
  const conversationId = typeof record.conversationId === "string"
    ? record.conversationId.trim()
    : "";
  return resolveDmRecordDirection({
    record,
    conversationId,
    myPublicKeyHex,
  }).isOutgoing;
};

type ChatStateMessageDiagnostics = Readonly<{
  dmConversationCount: number;
  dmCanonicalConversationCount: number;
  dmMessageCount: number;
  dmOutgoingCount: number;
  dmIncomingCount: number;
  dmMessageWithAttachmentsCount: number;
  dmAttachmentCount: number;
  dmIncomingOnlyConversationCount: number;
  dmOutgoingOnlyConversationCount: number;
  dmCanonicalConversationIdMismatchCount: number;
  dmCanonicalCollisionCount: number;
  dmCanonicalCollisionSample: string | null;
  groupConversationCount: number;
  groupMessageCount: number;
  groupSelfAuthoredCount: number;
  groupMessageWithAttachmentsCount: number;
  groupAttachmentCount: number;
}>;

type MessageRecordDiagnostics = Readonly<{
  recordCount: number;
  rawConversationCount: number;
  canonicalConversationCount: number;
  canonicalConversationIdMismatchCount: number;
  canonicalCollisionCount: number;
  canonicalCollisionSample: string | null;
  outgoingRecordCount: number;
  incomingRecordCount: number;
  incomingOnlyRawConversationCount: number;
}>;

const EMPTY_CHAT_STATE_MESSAGE_DIAGNOSTICS: ChatStateMessageDiagnostics = {
  dmConversationCount: 0,
  dmCanonicalConversationCount: 0,
  dmMessageCount: 0,
  dmOutgoingCount: 0,
  dmIncomingCount: 0,
  dmMessageWithAttachmentsCount: 0,
  dmAttachmentCount: 0,
  dmIncomingOnlyConversationCount: 0,
  dmOutgoingOnlyConversationCount: 0,
  dmCanonicalConversationIdMismatchCount: 0,
  dmCanonicalCollisionCount: 0,
  dmCanonicalCollisionSample: null,
  groupConversationCount: 0,
  groupMessageCount: 0,
  groupSelfAuthoredCount: 0,
  groupMessageWithAttachmentsCount: 0,
  groupAttachmentCount: 0,
};

const EMPTY_MESSAGE_RECORD_DIAGNOSTICS: MessageRecordDiagnostics = {
  recordCount: 0,
  rawConversationCount: 0,
  canonicalConversationCount: 0,
  canonicalConversationIdMismatchCount: 0,
  canonicalCollisionCount: 0,
  canonicalCollisionSample: null,
  outgoingRecordCount: 0,
  incomingRecordCount: 0,
  incomingOnlyRawConversationCount: 0,
};

const toConversationIdDiagnosticLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "unknown";
  }
  if (trimmed.length <= 20) {
    return trimmed;
  }
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
};

const toCanonicalDmConversationId = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): string => {
  const inferredPeer = inferPeerFromConversationId(params);
  if (!inferredPeer) {
    return params.conversationId;
  }
  return toDmConversationId({
    myPublicKeyHex: params.myPublicKeyHex,
    peerPublicKeyHex: inferredPeer,
  }) ?? params.conversationId;
};

const summarizePersistedChatStateMessages = (
  chatState: PersistedChatState | null | undefined,
  myPublicKeyHex: PublicKeyHex,
): ChatStateMessageDiagnostics => {
  if (!chatState) {
    return EMPTY_CHAT_STATE_MESSAGE_DIAGNOSTICS;
  }
  const conversationStatsById = new Map<string, Readonly<{ outgoing: number; incoming: number }>>();
  const canonicalSourceIds = new Map<string, Set<string>>();
  let dmCanonicalConversationIdMismatchCount = 0;
  let dmMessageCount = 0;
  let dmOutgoingCount = 0;
  let dmIncomingCount = 0;
  let dmMessageWithAttachmentsCount = 0;
  let dmAttachmentCount = 0;

  Object.entries(chatState.messagesByConversationId ?? {}).forEach(([conversationId, messages]) => {
    const canonicalConversationId = toCanonicalDmConversationId({
      conversationId,
      myPublicKeyHex,
    });
    if (canonicalConversationId !== conversationId) {
      dmCanonicalConversationIdMismatchCount += 1;
    }
    const canonicalSources = canonicalSourceIds.get(canonicalConversationId) ?? new Set<string>();
    canonicalSources.add(conversationId);
    canonicalSourceIds.set(canonicalConversationId, canonicalSources);

    let outgoing = 0;
    let incoming = 0;
    messages.forEach((message) => {
      const senderPubkey = normalizePublicKeyHex(message.pubkey);
      const isOutgoing = message.isOutgoing === true || senderPubkey === myPublicKeyHex;
      const attachmentCount = Array.isArray(message.attachments) ? message.attachments.length : 0;
      if (isOutgoing) {
        outgoing += 1;
      } else {
        incoming += 1;
      }
      if (attachmentCount > 0) {
        dmMessageWithAttachmentsCount += 1;
        dmAttachmentCount += attachmentCount;
      }
    });

    dmMessageCount += messages.length;
    dmOutgoingCount += outgoing;
    dmIncomingCount += incoming;
    conversationStatsById.set(conversationId, { outgoing, incoming });
  });

  const collisionEntries = Array.from(canonicalSourceIds.entries())
    .filter(([, sourceIds]) => sourceIds.size > 1);
  const dmCanonicalCollisionSample = collisionEntries.length === 0
    ? null
    : collisionEntries.slice(0, 3).map(([canonicalId, sourceIds]) => (
      `${toConversationIdDiagnosticLabel(canonicalId)}<=${Array.from(sourceIds).slice(0, 3).map(toConversationIdDiagnosticLabel).join("|")}`
    )).join(",");

  const dmIncomingOnlyConversationCount = Array.from(conversationStatsById.values())
    .filter((entry) => entry.incoming > 0 && entry.outgoing === 0).length;
  const dmOutgoingOnlyConversationCount = Array.from(conversationStatsById.values())
    .filter((entry) => entry.outgoing > 0 && entry.incoming === 0).length;

  const groupMessages = chatState.groupMessages ?? {};
  let groupMessageCount = 0;
  let groupSelfAuthoredCount = 0;
  let groupMessageWithAttachmentsCount = 0;
  let groupAttachmentCount = 0;
  Object.values(groupMessages).forEach((messages) => {
    groupMessageCount += messages.length;
    messages.forEach((message) => {
      if (normalizePublicKeyHex(message.pubkey) === myPublicKeyHex) {
        groupSelfAuthoredCount += 1;
      }
      const attachmentCandidate = (message as Readonly<Record<string, unknown>>).attachments;
      const attachmentCount = Array.isArray(attachmentCandidate) ? attachmentCandidate.length : 0;
      if (attachmentCount > 0) {
        groupMessageWithAttachmentsCount += 1;
        groupAttachmentCount += attachmentCount;
      }
    });
  });

  return {
    dmConversationCount: conversationStatsById.size,
    dmCanonicalConversationCount: canonicalSourceIds.size,
    dmMessageCount,
    dmOutgoingCount,
    dmIncomingCount,
    dmMessageWithAttachmentsCount,
    dmAttachmentCount,
    dmIncomingOnlyConversationCount,
    dmOutgoingOnlyConversationCount,
    dmCanonicalConversationIdMismatchCount,
    dmCanonicalCollisionCount: collisionEntries.length,
    dmCanonicalCollisionSample,
    groupConversationCount: Object.keys(groupMessages).length,
    groupMessageCount,
    groupSelfAuthoredCount,
    groupMessageWithAttachmentsCount,
    groupAttachmentCount,
  };
};

const summarizeMessageRecords = (
  records: ReadonlyArray<Readonly<Record<string, unknown>>>,
  myPublicKeyHex: PublicKeyHex,
): MessageRecordDiagnostics => {
  if (records.length === 0) {
    return EMPTY_MESSAGE_RECORD_DIAGNOSTICS;
  }

  const canonicalSourceIds = new Map<string, Set<string>>();
  const rawConversationStats = new Map<string, Readonly<{ outgoing: number; incoming: number }>>();
  let canonicalConversationIdMismatchCount = 0;
  let outgoingRecordCount = 0;

  records.forEach((record) => {
    const rawConversationId = typeof record.conversationId === "string" ? record.conversationId.trim() : "";
    if (!rawConversationId) {
      return;
    }

    const canonicalConversationId = toCanonicalDmConversationId({
      conversationId: rawConversationId,
      myPublicKeyHex,
    });
    if (canonicalConversationId !== rawConversationId) {
      canonicalConversationIdMismatchCount += 1;
    }
    const canonicalSources = canonicalSourceIds.get(canonicalConversationId) ?? new Set<string>();
    canonicalSources.add(rawConversationId);
    canonicalSourceIds.set(canonicalConversationId, canonicalSources);

    const hasOutgoingEvidence = hasOutgoingMessageEvidence(record, myPublicKeyHex);
    if (hasOutgoingEvidence) {
      outgoingRecordCount += 1;
    }
    const existingStats = rawConversationStats.get(rawConversationId) ?? { outgoing: 0, incoming: 0 };
    rawConversationStats.set(rawConversationId, hasOutgoingEvidence
      ? { outgoing: existingStats.outgoing + 1, incoming: existingStats.incoming }
      : { outgoing: existingStats.outgoing, incoming: existingStats.incoming + 1 });
  });

  const collisionEntries = Array.from(canonicalSourceIds.entries())
    .filter(([, sourceIds]) => sourceIds.size > 1);
  const canonicalCollisionSample = collisionEntries.length === 0
    ? null
    : collisionEntries.slice(0, 3).map(([canonicalId, sourceIds]) => (
      `${toConversationIdDiagnosticLabel(canonicalId)}<=${Array.from(sourceIds).slice(0, 3).map(toConversationIdDiagnosticLabel).join("|")}`
    )).join(",");

  const incomingOnlyRawConversationCount = Array.from(rawConversationStats.values())
    .filter((stats) => stats.incoming > 0 && stats.outgoing === 0).length;

  return {
    recordCount: records.length,
    rawConversationCount: rawConversationStats.size,
    canonicalConversationCount: canonicalSourceIds.size,
    canonicalConversationIdMismatchCount,
    canonicalCollisionCount: collisionEntries.length,
    canonicalCollisionSample,
    outgoingRecordCount,
    incomingRecordCount: Math.max(0, records.length - outgoingRecordCount),
    incomingOnlyRawConversationCount,
  };
};

const toPrefixedChatStateDiagnosticsContext = (
  prefix: string,
  diagnostics: ChatStateMessageDiagnostics,
): Readonly<Record<string, string | number | boolean | null>> => ({
  [`${prefix}DmConversationCount`]: diagnostics.dmConversationCount,
  [`${prefix}DmCanonicalConversationCount`]: diagnostics.dmCanonicalConversationCount,
  [`${prefix}DmMessageCount`]: diagnostics.dmMessageCount,
  [`${prefix}DmOutgoingCount`]: diagnostics.dmOutgoingCount,
  [`${prefix}DmIncomingCount`]: diagnostics.dmIncomingCount,
  [`${prefix}DmMessageWithAttachmentsCount`]: diagnostics.dmMessageWithAttachmentsCount,
  [`${prefix}DmAttachmentCount`]: diagnostics.dmAttachmentCount,
  [`${prefix}DmIncomingOnlyConversationCount`]: diagnostics.dmIncomingOnlyConversationCount,
  [`${prefix}DmOutgoingOnlyConversationCount`]: diagnostics.dmOutgoingOnlyConversationCount,
  [`${prefix}DmCanonicalConversationIdMismatchCount`]: diagnostics.dmCanonicalConversationIdMismatchCount,
  [`${prefix}DmCanonicalCollisionCount`]: diagnostics.dmCanonicalCollisionCount,
  [`${prefix}DmCanonicalCollisionSample`]: diagnostics.dmCanonicalCollisionSample,
  [`${prefix}GroupConversationCount`]: diagnostics.groupConversationCount,
  [`${prefix}GroupMessageCount`]: diagnostics.groupMessageCount,
  [`${prefix}GroupSelfAuthoredCount`]: diagnostics.groupSelfAuthoredCount,
  [`${prefix}GroupMessageWithAttachmentsCount`]: diagnostics.groupMessageWithAttachmentsCount,
  [`${prefix}GroupAttachmentCount`]: diagnostics.groupAttachmentCount,
});

const toPrefixedRecordDiagnosticsContext = (
  prefix: string,
  diagnostics: MessageRecordDiagnostics,
): Readonly<Record<string, string | number | boolean | null>> => ({
  [`${prefix}RecordCount`]: diagnostics.recordCount,
  [`${prefix}RawConversationCount`]: diagnostics.rawConversationCount,
  [`${prefix}CanonicalConversationCount`]: diagnostics.canonicalConversationCount,
  [`${prefix}CanonicalConversationIdMismatchCount`]: diagnostics.canonicalConversationIdMismatchCount,
  [`${prefix}CanonicalCollisionCount`]: diagnostics.canonicalCollisionCount,
  [`${prefix}CanonicalCollisionSample`]: diagnostics.canonicalCollisionSample,
  [`${prefix}OutgoingRecordCount`]: diagnostics.outgoingRecordCount,
  [`${prefix}IncomingRecordCount`]: diagnostics.incomingRecordCount,
  [`${prefix}IncomingOnlyRawConversationCount`]: diagnostics.incomingOnlyRawConversationCount,
});

type BackupRestoreHistoryRegressionStage =
  | "incoming_to_merged"
  | "merged_to_applied_store"
  | "post_apply_to_post_canonical_append";

const maybeEmitBackupRestoreHistoryRegression = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  stage: BackupRestoreHistoryRegressionStage;
  from: ChatStateMessageDiagnostics;
  to: ChatStateMessageDiagnostics;
  restorePath?: "full_v1" | "non_v1_domains" | "relay_sync_append";
  restoreChatStateDomains?: boolean;
  canonicalEventCount?: number;
}>): void => {
  const dmOutgoingDelta = params.to.dmOutgoingCount - params.from.dmOutgoingCount;
  const groupSelfAuthoredDelta = params.to.groupSelfAuthoredCount - params.from.groupSelfAuthoredCount;
  const dmAttachmentDelta = params.to.dmAttachmentCount - params.from.dmAttachmentCount;
  const groupAttachmentDelta = params.to.groupAttachmentCount - params.from.groupAttachmentCount;
  if (
    dmOutgoingDelta >= 0
    && groupSelfAuthoredDelta >= 0
    && dmAttachmentDelta >= 0
    && groupAttachmentDelta >= 0
  ) {
    return;
  }
  logAppEvent({
    name: "account_sync.backup_restore_history_regression",
    level: "warn",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      stage: params.stage,
      restorePath: params.restorePath ?? null,
      restoreChatStateDomains: typeof params.restoreChatStateDomains === "boolean"
        ? params.restoreChatStateDomains
        : null,
      canonicalEventCount: typeof params.canonicalEventCount === "number"
        ? params.canonicalEventCount
        : null,
      dmOutgoingDropped: dmOutgoingDelta < 0,
      groupSelfAuthoredDropped: groupSelfAuthoredDelta < 0,
      dmAttachmentDropped: dmAttachmentDelta < 0,
      groupAttachmentDropped: groupAttachmentDelta < 0,
      dmOutgoingDelta,
      groupSelfAuthoredDelta,
      dmAttachmentDelta,
      groupAttachmentDelta,
      fromDmOutgoingCount: params.from.dmOutgoingCount,
      toDmOutgoingCount: params.to.dmOutgoingCount,
      fromDmMessageCount: params.from.dmMessageCount,
      toDmMessageCount: params.to.dmMessageCount,
      fromDmAttachmentCount: params.from.dmAttachmentCount,
      toDmAttachmentCount: params.to.dmAttachmentCount,
      fromGroupSelfAuthoredCount: params.from.groupSelfAuthoredCount,
      toGroupSelfAuthoredCount: params.to.groupSelfAuthoredCount,
      fromGroupMessageCount: params.from.groupMessageCount,
      toGroupMessageCount: params.to.groupMessageCount,
      fromGroupAttachmentCount: params.from.groupAttachmentCount,
      toGroupAttachmentCount: params.to.groupAttachmentCount,
      fromDmCanonicalCollisionCount: params.from.dmCanonicalCollisionCount,
      toDmCanonicalCollisionCount: params.to.dmCanonicalCollisionCount,
      fromDmCanonicalCollisionSample: params.from.dmCanonicalCollisionSample,
      toDmCanonicalCollisionSample: params.to.dmCanonicalCollisionSample,
    },
  });
};

const hydrateChatStateFromIndexedMessages = async (
  publicKeyHex: PublicKeyHex,
  chatState: PersistedChatState | null
): Promise<PersistedChatState | null> => {
  const baseState: PersistedChatState = chatState ?? {
    version: 2,
    createdConnections: [],
    createdGroups: [],
    unreadByConversationId: {},
    connectionOverridesByConnectionId: {},
    messagesByConversationId: {},
    groupMessages: {},
    connectionRequests: [],
    pinnedChatIds: [],
    hiddenChatIds: [],
  };

  const indexedRecords = await loadIndexedMessageRecords();
  const convergenceGuardEnabled = PrivacySettingsService.getSettings().accountSyncConvergenceV091 === true;
  const indexedConversationIds = new Set<string>();
  const indexedConversationsWithOutgoingEvidence = new Set<string>();
  indexedRecords.forEach((record) => {
    const conversationId = typeof record.conversationId === "string" ? record.conversationId.trim() : "";
    if (!conversationId) {
      return;
    }
    indexedConversationIds.add(conversationId);
    if (hasOutgoingMessageEvidence(record, publicKeyHex)) {
      indexedConversationsWithOutgoingEvidence.add(conversationId);
    }
  });
  const hasIndexedConversationWithoutOutgoingEvidence = Array.from(indexedConversationIds).some(
    (conversationId) => !indexedConversationsWithOutgoingEvidence.has(conversationId),
  );
  const shouldScanQueueRecords = convergenceGuardEnabled
    || indexedRecords.length === 0
    || hasIndexedConversationWithoutOutgoingEvidence;
  const queueRecords = shouldScanQueueRecords
    ? await loadMessageQueueRecords(publicKeyHex)
    : [];
  const records = [...indexedRecords, ...queueRecords];
  const recordDiagnostics = summarizeMessageRecords(records, publicKeyHex);
  if (records.length === 0) {
    return baseState;
  }

  const messagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {
    ...baseState.messagesByConversationId,
  };
  const groupMessagesByConversationId: Record<string, ReadonlyArray<PersistedGroupMessage>> = {
    ...(baseState.groupMessages ?? {}),
  };
  const conversationById = new Map<string, PersistedChatState["createdConnections"][number]>(
    baseState.createdConnections.map((entry) => [entry.id, entry] as const)
  );

  records.forEach((record) => {
    const ownerPubkey = normalizePublicKeyHex(
      typeof record.ownerPubkey === "string" ? record.ownerPubkey : undefined
    );
    if (ownerPubkey && ownerPubkey !== publicKeyHex) {
      return;
    }
    const parsedGroup = toPersistedGroupMessageFromIndexedRecord({
      record,
      myPublicKeyHex: publicKeyHex,
    });
    if (parsedGroup) {
      const existingGroupMessages = groupMessagesByConversationId[parsedGroup.conversationId] ?? [];
      groupMessagesByConversationId[parsedGroup.conversationId] = mergePersistedGroupMessages(
        existingGroupMessages,
        [parsedGroup.persistedMessage],
      );
      return;
    }
    const parsed = toPersistedMessageFromIndexedRecord({
      record,
      myPublicKeyHex: publicKeyHex,
    });
    if (!parsed) {
      return;
    }

    const existingMessages = messagesByConversationId[parsed.conversationId] ?? [];
    messagesByConversationId[parsed.conversationId] = mergePersistedMessages(existingMessages, [parsed.persistedMessage]);

    if (!parsed.peerPublicKeyHex) {
      return;
    }
    const existingConversation = conversationById.get(parsed.conversationId);
    const nextLastMessageAtUnixMs = Math.max(
      existingConversation?.lastMessageTimeMs ?? 0,
      parsed.persistedMessage.timestampMs,
    );
    const nextConversation = {
      id: parsed.conversationId,
      displayName: existingConversation?.displayName ?? parsed.peerPublicKeyHex.slice(0, 8),
      pubkey: parsed.peerPublicKeyHex,
      lastMessage: toPreview(parsed.persistedMessage.content || existingConversation?.lastMessage || ""),
      unreadCount: existingConversation?.unreadCount ?? 0,
      lastMessageTimeMs: nextLastMessageAtUnixMs,
    };
    conversationById.set(parsed.conversationId, nextConversation);
  });

  let nextState: PersistedChatState = {
    ...baseState,
    createdConnections: Array.from(conversationById.values()),
    messagesByConversationId,
    groupMessages: groupMessagesByConversationId,
  };

  const outgoingCountBeforeProjectionFallback = getPersistedOutgoingMessageCount(nextState, publicKeyHex);
  const hasOutgoingHistory = outgoingCountBeforeProjectionFallback > 0;
  const sparseOutgoingEvidenceThreshold = Math.max(1, Math.floor(recordDiagnostics.recordCount * 0.03));
  const hasSparseOutgoingEvidence = (
    recordDiagnostics.recordCount >= 12
    && recordDiagnostics.incomingRecordCount >= 8
    && recordDiagnostics.outgoingRecordCount <= sparseOutgoingEvidenceThreshold
  );
  const shouldRunProjectionFallback = !hasOutgoingHistory || hasSparseOutgoingEvidence;
  if (shouldRunProjectionFallback) {
    try {
      const profileId = getActiveProfileIdSafe();
      const eventLogEntries = await accountEventStore.loadEvents({
        profileId,
        accountPublicKeyHex: publicKeyHex,
      });
      const projection = replayAccountEvents(eventLogEntries);
      if (projection) {
        const mergedMessagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {
          ...nextState.messagesByConversationId,
        };
        const mergedConversationsById = new Map<string, PersistedChatState["createdConnections"][number]>(
          nextState.createdConnections.map((conversation) => [conversation.id, conversation] as const),
        );
        Object.entries(projection.messagesByConversationId).forEach(([conversationId, timeline]) => {
          if (timeline.length === 0) {
            return;
          }
          const mappedMessages: ReadonlyArray<PersistedMessage> = timeline.map((entry) => {
            const isOutgoing = entry.direction === "outgoing";
            const fallbackAttachments = extractAttachmentsFromContent(entry.plaintextPreview);
            return {
              id: entry.messageId,
              content: entry.plaintextPreview,
              timestampMs: entry.eventCreatedAtUnixSeconds * 1000,
              isOutgoing,
              status: "delivered",
              pubkey: isOutgoing ? publicKeyHex : entry.peerPublicKeyHex,
              ...(fallbackAttachments.length > 0 ? { attachments: fallbackAttachments } : {}),
            };
          });
          const existingMessages = mergedMessagesByConversationId[conversationId] ?? [];
          const mergedMessages = mergePersistedMessages(existingMessages, mappedMessages);
          mergedMessagesByConversationId[conversationId] = mergedMessages;
          const lastMessage = mergedMessages[mergedMessages.length - 1];
          const peerPublicKeyHex = projection.conversationsById[conversationId]?.peerPublicKeyHex
            ?? timeline[timeline.length - 1]?.peerPublicKeyHex;
          if (!lastMessage || !peerPublicKeyHex) {
            return;
          }
          const existingConversation = mergedConversationsById.get(conversationId);
          mergedConversationsById.set(conversationId, {
            id: conversationId,
            displayName: existingConversation?.displayName ?? peerPublicKeyHex.slice(0, 8),
            pubkey: peerPublicKeyHex,
            lastMessage: toPreview(lastMessage.content || existingConversation?.lastMessage || ""),
            unreadCount: existingConversation?.unreadCount ?? 0,
            lastMessageTimeMs: Math.max(
              existingConversation?.lastMessageTimeMs ?? 0,
              lastMessage.timestampMs,
            ),
          });
        });
        nextState = {
          ...nextState,
          createdConnections: Array.from(mergedConversationsById.values()),
          messagesByConversationId: mergedMessagesByConversationId,
        };
        logAppEvent({
          name: "account_sync.backup_payload_projection_fallback",
          level: "info",
          scope: { feature: "account_sync", action: "backup_publish" },
          context: {
            profileId,
            reasonNoOutgoingHistory: !hasOutgoingHistory,
            reasonSparseOutgoingEvidence: hasSparseOutgoingEvidence,
            sparseOutgoingEvidenceThreshold,
            eventLogCount: eventLogEntries.length,
            outgoingCountBeforeFallback: outgoingCountBeforeProjectionFallback,
            outgoingCountAfterFallback: getPersistedOutgoingMessageCount(nextState, publicKeyHex),
            sourceRecordCount: recordDiagnostics.recordCount,
            sourceOutgoingRecordCount: recordDiagnostics.outgoingRecordCount,
            sourceIncomingRecordCount: recordDiagnostics.incomingRecordCount,
            sourceIncomingOnlyRawConversationCount: recordDiagnostics.incomingOnlyRawConversationCount,
            indexedRecordCount: indexedRecords.length,
            queueRecordCount: queueRecords.length,
          },
        });
      }
    } catch (error) {
      logAppEvent({
        name: "account_sync.backup_payload_projection_fallback_failed",
        level: "warn",
        scope: { feature: "account_sync", action: "backup_publish" },
        context: {
          reason: error instanceof Error ? error.message : String(error),
          indexedRecordCount: indexedRecords.length,
          queueRecordCount: queueRecords.length,
        },
      });
    }
  }

  nextState = sanitizePersistedChatStateMessagesByDeleteContract(nextState) ?? nextState;

  const hydratedChatStateDiagnostics = summarizePersistedChatStateMessages(nextState, publicKeyHex);
  logAppEvent({
    name: "account_sync.backup_payload_hydration_diagnostics",
    level: "info",
    scope: { feature: "account_sync", action: "backup_publish" },
    context: {
      publicKeySuffix: publicKeyHex.slice(-8),
      indexedRecordCount: indexedRecords.length,
      queueRecordCount: queueRecords.length,
      shouldScanQueueRecords,
      convergenceGuardEnabled,
      hasIndexedConversationWithoutOutgoingEvidence,
      ...toPrefixedRecordDiagnosticsContext("source", recordDiagnostics),
      ...toPrefixedChatStateDiagnosticsContext("hydrated", hydratedChatStateDiagnostics),
    },
  });

  return nextState;
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

const buildBackupPayload = (
  publicKeyHex: PublicKeyHex,
  chatStateOverride?: EncryptedAccountBackupPayload["chatState"],
  roomKeyOverride?: ReadonlyArray<RoomKeySnapshot>,
): EncryptedAccountBackupPayload => {
  const profileId = getActiveProfileIdSafe();
  const chatState = sanitizePersistedChatStateMessagesByDeleteContract(
    chatStateOverride ?? chatStateStoreService.load(publicKeyHex)
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
  const chatState = sanitizePersistedChatStateMessagesByDeleteContract(parsed.chatState ?? null);
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
      source: "pool",
      publicKeyHex,
      selectedEvent: poolFetchResult.event,
      poolOpenRelayCount: openRelayUrls.size,
      poolExpectedEoseRelayCount,
      poolReceivedEoseRelayCount: poolFetchResult.receivedEoseRelayCount,
      poolCandidateCount: poolFetchResult.candidateCount,
      poolTimedOut: poolFetchResult.timedOut,
      fallbackRelayCount: 0,
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
    source: fallbackEvent ? "direct" : "none",
    publicKeyHex,
    selectedEvent: fallbackEvent,
    poolOpenRelayCount: openRelayUrls.size,
    poolExpectedEoseRelayCount,
    poolReceivedEoseRelayCount: poolFetchResult.receivedEoseRelayCount,
    poolCandidateCount: poolFetchResult.candidateCount,
    poolTimedOut: poolFetchResult.timedOut,
    fallbackRelayCount: fallbackRelayUrls.length,
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
  const sanitizedIncomingChatState = sanitizePersistedChatStateMessagesByDeleteContract(payload.chatState);
  const sanitizedIncomingPayload: EncryptedAccountBackupPayload = hasReplayableChatHistory(sanitizedIncomingChatState)
    ? {
      ...payload,
      chatState: sanitizedIncomingChatState,
    }
    : {
      ...payload,
      chatState: sanitizedIncomingChatState,
      syncCheckpoints: [],
    };
  const {
    communityMembershipLedger: _incomingCommunityMembershipLedger,
    roomKeys: _incomingRoomKeys,
    ...sanitizedIncomingPayloadWithoutCommunityState
  } = sanitizedIncomingPayload;
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
  const canTrustIncomingPortableState = hasPortablePrivateStateEvidence(sanitizedIncomingPayload);
  const shouldHydrateLocalMessages = (
    includeHydratedLocalMessages
    && (
      !freshDevice
      || !canTrustIncomingPortableState
      || shouldUseRecoverySnapshot
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
  const currentPayload = (
    existingLocalPrivateState
    || hasHydratedLocalReplayableHistory
    || hasExplicitLocalLedgerEvidence
    || hasExplicitLocalRoomKeyEvidence
  )
    ? currentPayloadCandidate
    : shouldUseRecoverySnapshot
      ? recoverySnapshot
      : null;
  if (currentPayload) {
    saveRecoverySnapshot(publicKeyHex, currentPayload);
  }
  const incomingLedgerEntries = parseCommunityMembershipLedgerSnapshot(sanitizedIncomingPayload.communityMembershipLedger);
  const currentLedgerEntries = parseCommunityMembershipLedgerSnapshot(currentPayload?.communityMembershipLedger);
  const localExplicitLedgerEntries = currentLedgerEntries.length > 0
    ? currentLedgerEntries
    : existingLedgerEntries;
  const incomingRoomKeySnapshotsRaw = parseRoomKeySnapshots(sanitizedIncomingPayload.roomKeys);
  const currentRoomKeySnapshots = parseRoomKeySnapshots(currentPayload?.roomKeys);
  const localExplicitRoomKeySnapshotsRaw = currentRoomKeySnapshots.length > 0
    ? currentRoomKeySnapshots
    : existingScopedRoomKeySnapshots;
  const mergedChatState = currentPayload
    ? mergeChatState(currentPayload.chatState, sanitizedIncomingPayload.chatState)
    : sanitizedIncomingPayload.chatState;
  const reconstructedIncomingLedgerEntries = reconstructCommunityMembershipFromChatState(sanitizedIncomingPayload.chatState);
  const reconstructedMergedLedgerEntries = reconstructCommunityMembershipFromChatState(mergedChatState);
  const reconciledIncomingLedgerEntries = reconcileIncomingLedgerWithReconstructedJoinedEvidence({
    incomingExplicitEntries: incomingLedgerEntries,
    reconstructedEntries: reconstructedIncomingLedgerEntries,
  });
  const localExplicitRoomKeySnapshots = filterRoomKeySnapshotsToJoinedEvidence({
    roomKeys: localExplicitRoomKeySnapshotsRaw,
    explicitLedgerEntries: localExplicitLedgerEntries,
    chatState: currentPayload?.chatState,
  });
  const incomingRoomKeySnapshots = filterRoomKeySnapshotsToJoinedEvidence({
    roomKeys: incomingRoomKeySnapshotsRaw,
    explicitLedgerEntries: reconciledIncomingLedgerEntries,
    chatState: sanitizedIncomingPayload.chatState,
  });
  const mergedExplicitRoomKeys = mergeRoomKeySnapshots(localExplicitRoomKeySnapshots, incomingRoomKeySnapshots);
  const incomingSupplementedLedgerEntries = supplementMembershipLedgerEntries({
    explicitEntries: [
      ...reconciledIncomingLedgerEntries,
      ...localExplicitLedgerEntries,
    ],
    supplementalEntries: reconstructedMergedLedgerEntries,
  });
  const mergedCommunityMembershipLedger = mergeCommunityMembershipLedgerEntries(
    localExplicitLedgerEntries,
    incomingSupplementedLedgerEntries,
  );
  const mergedJoinedGroupIds = selectJoinedGroupIds(mergedCommunityMembershipLedger);
  const reconstructedMergedRoomKeySnapshots = reconstructRoomKeySnapshotsFromChatState(mergedChatState, {
    restrictToJoinedGroupIds: mergedJoinedGroupIds,
  });
  const mergedRoomKeys = mergeRoomKeySnapshots(mergedExplicitRoomKeys, reconstructedMergedRoomKeySnapshots);
  const mergedPayload: EncryptedAccountBackupPayload = currentPayload
    ? {
      ...sanitizedIncomingPayloadWithoutCommunityState,
      identityUnlock: mergeIdentityUnlock(
        currentPayload.identityUnlock,
        sanitizedIncomingPayload.identityUnlock,
      ),
      profile: {
        ...currentPayload.profile,
        ...sanitizedIncomingPayload.profile,
      },
      peerTrust: mergePeerTrust(currentPayload.peerTrust, sanitizedIncomingPayload.peerTrust),
      requestFlowEvidence: mergeRequestFlowEvidence(currentPayload.requestFlowEvidence, sanitizedIncomingPayload.requestFlowEvidence),
      requestOutbox: mergeOutbox(currentPayload.requestOutbox, sanitizedIncomingPayload.requestOutbox),
      syncCheckpoints: mergeCheckpoints(currentPayload.syncCheckpoints, sanitizedIncomingPayload.syncCheckpoints),
      chatState: mergedChatState,
      privacySettings: {
        ...sanitizedIncomingPayload.privacySettings,
        ...currentPayload.privacySettings,
      },
      relayList: mergeRelayList(currentPayload.relayList, sanitizedIncomingPayload.relayList),
      uiSettings: {
        themePreference: isThemePreference(sanitizedIncomingPayload.uiSettings?.themePreference)
          ? sanitizedIncomingPayload.uiSettings.themePreference
          : currentPayload.uiSettings?.themePreference ?? DEFAULT_THEME_PREFERENCE,
        accessibilityPreferences: {
          ...(currentPayload.uiSettings?.accessibilityPreferences ?? DEFAULT_ACCESSIBILITY_PREFERENCES),
          ...parseAccessibilityPreferences(sanitizedIncomingPayload.uiSettings?.accessibilityPreferences),
        },
        localMediaStorageConfig: {
          ...(currentPayload.uiSettings?.localMediaStorageConfig ?? DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG),
          ...(sanitizedIncomingPayload.uiSettings?.localMediaStorageConfig ?? {}),
        },
      },
      ...(mergedCommunityMembershipLedger.length > 0
        ? { communityMembershipLedger: mergedCommunityMembershipLedger }
        : {}),
      ...(mergedRoomKeys.length > 0
        ? { roomKeys: mergedRoomKeys }
        : {}),
    }
    : (
      mergedCommunityMembershipLedger.length > 0 || mergedRoomKeys.length > 0
        ? {
          ...sanitizedIncomingPayloadWithoutCommunityState,
          chatState: mergedChatState,
          ...(mergedCommunityMembershipLedger.length > 0
            ? { communityMembershipLedger: mergedCommunityMembershipLedger }
            : {}),
          ...(mergedRoomKeys.length > 0
            ? { roomKeys: mergedRoomKeys }
            : {}),
        }
        : {
          ...sanitizedIncomingPayloadWithoutCommunityState,
          chatState: mergedChatState,
        }
    );
  const incomingChatDiagnostics = summarizePersistedChatStateMessages(
    sanitizedIncomingPayload.chatState,
    publicKeyHex,
  );
  const localChatDiagnostics = summarizePersistedChatStateMessages(
    currentPayload?.chatState,
    publicKeyHex,
  );
  const mergedChatDiagnostics = summarizePersistedChatStateMessages(
    mergedPayload.chatState,
    publicKeyHex,
  );
  maybeEmitBackupRestoreHistoryRegression({
    publicKeyHex,
    stage: "incoming_to_merged",
    from: incomingChatDiagnostics,
    to: mergedChatDiagnostics,
  });
  logAppEvent({
    name: "account_sync.backup_restore_merge_diagnostics",
    level: "info",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      publicKeySuffix: publicKeyHex.slice(-8),
      freshDevice,
      includeHydratedLocalMessages,
      shouldHydrateLocalMessages,
      canTrustIncomingPortableState,
      localPayloadMerged: currentPayload !== null,
      hasHydratedLocalReplayableHistory,
      hasExplicitLocalLedgerEvidence,
      hasExplicitLocalRoomKeyEvidence,
      recoverySnapshotAvailable: recoverySnapshot !== null,
      recoverySnapshotUsed: (
        currentPayload !== null
        && recoverySnapshot !== null
        && currentPayload.createdAtUnixMs === recoverySnapshot.createdAtUnixMs
      ),
      recoverySnapshotHasReplayableHistory,
      recoverySnapshotHasExplicitLedgerEvidence,
      recoverySnapshotHasExplicitRoomKeyEvidence,
      incomingLedgerEntryCount: incomingLedgerEntries.length,
      incomingLedgerReconciledEntryCount: reconciledIncomingLedgerEntries.length,
      mergedChatReconstructedLedgerEntryCount: reconstructedMergedLedgerEntries.length,
      incomingLedgerJoinPromotionCount: reconciledIncomingLedgerEntries.reduce((count, entry, index) => {
        const incomingEntry = incomingLedgerEntries[index];
        if (!incomingEntry) {
          return count;
        }
        return incomingEntry.status !== "joined" && entry.status === "joined"
          ? count + 1
          : count;
      }, 0),
      localLedgerEntryCount: localExplicitLedgerEntries.length,
      mergedLedgerEntryCount: mergedCommunityMembershipLedger.length,
      incomingRoomKeyCount: incomingRoomKeySnapshots.length,
      localRoomKeyCount: localExplicitRoomKeySnapshots.length,
      mergedExplicitRoomKeyCount: mergedExplicitRoomKeys.length,
      mergedReconstructedRoomKeyCount: reconstructedMergedRoomKeySnapshots.length,
      mergedRoomKeyCount: mergedRoomKeys.length,
      ...toPrefixedChatStateDiagnosticsContext("incoming", incomingChatDiagnostics),
      ...toPrefixedChatStateDiagnosticsContext("local", localChatDiagnostics),
      ...toPrefixedChatStateDiagnosticsContext("merged", mergedChatDiagnostics),
    },
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
  const mergedPayloadChatDiagnostics = summarizePersistedChatStateMessages(mergedPayload.chatState, publicKeyHex);
  if (mergedPayload.chatState) {
    // Backup restore should not immediately trigger mutation-driven backup publish.
    chatStateStoreService.replace(publicKeyHex, mergedPayload.chatState, { emitMutationSignal: false });
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
  logAppEvent({
    name: "account_sync.backup_restore_apply_diagnostics",
    level: "info",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      publicKeySuffix: publicKeyHex.slice(-8),
      restorePath: "full_v1",
      appliedRoomKeyCount: parseRoomKeySnapshots(mergedPayload.roomKeys).length,
      ...toPrefixedChatStateDiagnosticsContext(
        "applied",
        mergedPayloadChatDiagnostics,
      ),
    },
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
  saveCommunityMembershipLedger(publicKeyHex, mergedPayload.communityMembershipLedger ?? []);
  await applyRoomKeySnapshots(mergedPayload.roomKeys ?? []);
  PrivacySettingsService.saveSettings(mergedPayload.privacySettings);
  relayListInternals.saveRelayListToStorage(publicKeyHex, mergedPayload.relayList);
  persistUiSettingsSnapshot(profileId, mergedPayload.uiSettings);
  const mergedPayloadChatDiagnostics = summarizePersistedChatStateMessages(mergedPayload.chatState, publicKeyHex);
  if (options?.restoreChatStateDomains && mergedPayload.chatState) {
    // Canonical account-event append does not yet materialize all chat-state domains
    // (group timelines/membership views and legacy message surfaces). Restore chat
    // state domains directly so new-device rehydrate cannot drop self-authored history.
    chatStateStoreService.replace(publicKeyHex, mergedPayload.chatState, { emitMutationSignal: false });
    const restoredChatStateDiagnostics = summarizePersistedChatStateMessages(
      chatStateStoreService.load(publicKeyHex),
      publicKeyHex,
    );
    maybeEmitBackupRestoreHistoryRegression({
      publicKeyHex,
      stage: "merged_to_applied_store",
      from: mergedPayloadChatDiagnostics,
      to: restoredChatStateDiagnostics,
      restorePath: "non_v1_domains",
      restoreChatStateDomains: true,
    });
  }
  logAppEvent({
    name: "account_sync.backup_restore_apply_diagnostics",
    level: "info",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      publicKeySuffix: publicKeyHex.slice(-8),
      restorePath: "non_v1_domains",
      restoreChatStateDomains: options?.restoreChatStateDomains === true,
      appliedRoomKeyCount: parseRoomKeySnapshots(mergedPayload.roomKeys).length,
      ...toPrefixedChatStateDiagnosticsContext(
        "applied",
        mergedPayloadChatDiagnostics,
      ),
    },
  });
};

const isRelayPoolWithSubscribe = (pool: RelayPoolLike): pool is RelayPoolWithSubscribe => {
  const candidate = pool as Partial<RelayPoolWithSubscribe>;
  return typeof candidate.sendToOpen === "function"
    && typeof candidate.subscribeToMessages === "function";
};

type BackupPayloadConvergenceDiagnostics = Readonly<{
  dmOutgoingCount: number;
  dmIncomingCount: number;
  groupConversationCount: number;
  groupMessageCount: number;
  groupSelfAuthoredCount: number;
  joinedLedgerCount: number;
  roomKeyCount: number;
  groupEvidenceCount: number;
}>;

const summarizeBackupPayloadConvergenceDiagnostics = (
  payload: EncryptedAccountBackupPayload,
  publicKeyHex: PublicKeyHex,
): BackupPayloadConvergenceDiagnostics => {
  const chatDiagnostics = summarizePersistedChatStateMessages(payload.chatState, publicKeyHex);
  const joinedLedgerCount = selectJoinedCommunityMembershipLedgerEntries(
    parseCommunityMembershipLedgerSnapshot(payload.communityMembershipLedger),
  ).length;
  const roomKeyCount = parseRoomKeySnapshots(payload.roomKeys).length;
  const groupEvidenceCount = chatDiagnostics.groupConversationCount
    + chatDiagnostics.groupMessageCount
    + chatDiagnostics.groupSelfAuthoredCount
    + joinedLedgerCount
    + roomKeyCount;
  return {
    dmOutgoingCount: chatDiagnostics.dmOutgoingCount,
    dmIncomingCount: chatDiagnostics.dmIncomingCount,
    groupConversationCount: chatDiagnostics.groupConversationCount,
    groupMessageCount: chatDiagnostics.groupMessageCount,
    groupSelfAuthoredCount: chatDiagnostics.groupSelfAuthoredCount,
    joinedLedgerCount,
    roomKeyCount,
    groupEvidenceCount,
  };
};

const hasSparseDmOutgoingEvidenceForConvergenceFloor = (
  diagnostics: BackupPayloadConvergenceDiagnostics,
): boolean => {
  const dmMessageCount = diagnostics.dmOutgoingCount + diagnostics.dmIncomingCount;
  if (dmMessageCount < 12 || diagnostics.dmIncomingCount < 8) {
    return false;
  }
  const sparseOutgoingEvidenceThreshold = Math.max(1, Math.floor(dmMessageCount * 0.03));
  return diagnostics.dmOutgoingCount <= sparseOutgoingEvidenceThreshold;
};

type BackupPublishConvergenceFetchStatus =
  | "not_required"
  | "pool_unavailable"
  | "no_backup"
  | "degraded_backup"
  | "fetched"
  | "error";

type BackupPublishConvergenceResult = Readonly<{
  payload: EncryptedAccountBackupPayload;
  localDiagnostics: BackupPayloadConvergenceDiagnostics;
  remoteDiagnostics?: BackupPayloadConvergenceDiagnostics;
  floorRequired: boolean;
  localLowEvidence: boolean;
  remoteHasBackup: boolean;
  fetchStatus: BackupPublishConvergenceFetchStatus;
}>;

const isLowEvidenceBackupPayloadForPublish = (
  payload: EncryptedAccountBackupPayload,
  diagnostics: BackupPayloadConvergenceDiagnostics,
): boolean => (
  !hasReplayableChatHistory(payload.chatState)
  && diagnostics.groupEvidenceCount === 0
  && diagnostics.dmOutgoingCount === 0
);

const mergeBackupPayloadForPublishConvergence = (
  localPayload: EncryptedAccountBackupPayload,
  remotePayload: EncryptedAccountBackupPayload,
): EncryptedAccountBackupPayload => {
  const mergedChatState = mergeChatState(localPayload.chatState, remotePayload.chatState);
  const remoteLedgerEntries = parseCommunityMembershipLedgerSnapshot(remotePayload.communityMembershipLedger);
  const localLedgerEntries = parseCommunityMembershipLedgerSnapshot(localPayload.communityMembershipLedger);
  const reconstructedRemoteLedgerEntries = reconstructCommunityMembershipFromChatState(remotePayload.chatState);
  const reconciledRemoteLedgerEntries = reconcileIncomingLedgerWithReconstructedJoinedEvidence({
    incomingExplicitEntries: remoteLedgerEntries,
    reconstructedEntries: reconstructedRemoteLedgerEntries,
  });
  const mergedExplicitLedgerEntries = mergeCommunityMembershipLedgerEntries(
    localLedgerEntries,
    reconciledRemoteLedgerEntries,
  );
  const mergedSupplementedLedgerEntries = supplementMembershipLedgerEntries({
    explicitEntries: mergedExplicitLedgerEntries,
    supplementalEntries: reconstructCommunityMembershipFromChatState(mergedChatState),
  });
  const mergedCommunityMembershipLedger = mergeCommunityMembershipLedgerEntries(
    mergedExplicitLedgerEntries,
    mergedSupplementedLedgerEntries,
  );
  const mergedExplicitRoomKeys = mergeRoomKeySnapshots(
    parseRoomKeySnapshots(localPayload.roomKeys),
    parseRoomKeySnapshots(remotePayload.roomKeys),
  );
  const mergedJoinedGroupIds = selectJoinedGroupIds(mergedCommunityMembershipLedger);
  const reconstructedMergedRoomKeys = reconstructRoomKeySnapshotsFromChatState(mergedChatState, {
    restrictToJoinedGroupIds: mergedJoinedGroupIds,
  });
  const mergedRoomKeys = mergeRoomKeySnapshots(
    mergedExplicitRoomKeys,
    reconstructedMergedRoomKeys,
  );

  return {
    ...localPayload,
    identityUnlock: mergeIdentityUnlock(localPayload.identityUnlock, remotePayload.identityUnlock),
    peerTrust: mergePeerTrust(localPayload.peerTrust, remotePayload.peerTrust),
    requestFlowEvidence: mergeRequestFlowEvidence(localPayload.requestFlowEvidence, remotePayload.requestFlowEvidence),
    requestOutbox: mergeOutbox(localPayload.requestOutbox, remotePayload.requestOutbox),
    syncCheckpoints: mergeCheckpoints(localPayload.syncCheckpoints, remotePayload.syncCheckpoints),
    chatState: mergedChatState,
    relayList: mergeRelayList(localPayload.relayList, remotePayload.relayList),
    ...(mergedCommunityMembershipLedger.length > 0
      ? { communityMembershipLedger: mergedCommunityMembershipLedger }
      : {}),
    ...(mergedRoomKeys.length > 0
      ? { roomKeys: mergedRoomKeys }
      : {}),
  };
};

const maybeConvergeBackupPayloadBeforePublish = async (params: Readonly<{
  localPayload: EncryptedAccountBackupPayload;
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  pool: RelayPoolLike;
}>): Promise<BackupPublishConvergenceResult> => {
  const localDiagnostics = summarizeBackupPayloadConvergenceDiagnostics(params.localPayload, params.publicKeyHex);
  const applyGroupEvidenceFloor = localDiagnostics.groupEvidenceCount === 0;
  const applySparseDmOutgoingFloor = hasSparseDmOutgoingEvidenceForConvergenceFloor(localDiagnostics);
  const floorRequired = applyGroupEvidenceFloor || applySparseDmOutgoingFloor;
  const localLowEvidence = isLowEvidenceBackupPayloadForPublish(
    params.localPayload,
    localDiagnostics,
  );
  if (!floorRequired) {
    return {
      payload: params.localPayload,
      localDiagnostics,
      floorRequired: false,
      localLowEvidence,
      remoteHasBackup: false,
      fetchStatus: "not_required",
    };
  }
  if (!isRelayPoolWithSubscribe(params.pool)) {
    return {
      payload: params.localPayload,
      localDiagnostics,
      floorRequired: true,
      localLowEvidence,
      remoteHasBackup: false,
      fetchStatus: "pool_unavailable",
    };
  }

  try {
    const fetched = await encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload({
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
      pool: params.pool,
    });
    if (!fetched.hasBackup || !fetched.payload) {
      return {
        payload: params.localPayload,
        localDiagnostics,
        floorRequired: true,
        localLowEvidence,
        remoteHasBackup: false,
        fetchStatus: "no_backup",
      };
    }
    if (fetched.degradedReason) {
      return {
        payload: params.localPayload,
        localDiagnostics,
        floorRequired: true,
        localLowEvidence,
        remoteHasBackup: true,
        fetchStatus: "degraded_backup",
      };
    }

    const remoteDiagnostics = summarizeBackupPayloadConvergenceDiagnostics(
      fetched.payload,
      params.publicKeyHex,
    );
    const shouldConverge = remoteDiagnostics.groupEvidenceCount > localDiagnostics.groupEvidenceCount
      || remoteDiagnostics.dmOutgoingCount > localDiagnostics.dmOutgoingCount;
    if (!shouldConverge) {
      return {
        payload: params.localPayload,
        localDiagnostics,
        remoteDiagnostics,
        floorRequired: true,
        localLowEvidence,
        remoteHasBackup: true,
        fetchStatus: "fetched",
      };
    }

    const convergedPayload = mergeBackupPayloadForPublishConvergence(params.localPayload, fetched.payload);
    const convergedDiagnostics = summarizeBackupPayloadConvergenceDiagnostics(
      convergedPayload,
      params.publicKeyHex,
    );
    logAppEvent({
      name: "account_sync.backup_publish_convergence_floor_applied",
      level: "warn",
      scope: { feature: "account_sync", action: "backup_publish" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        applyGroupEvidenceFloor,
        applySparseDmOutgoingFloor,
        localGroupEvidenceCount: localDiagnostics.groupEvidenceCount,
        remoteGroupEvidenceCount: remoteDiagnostics.groupEvidenceCount,
        convergedGroupEvidenceCount: convergedDiagnostics.groupEvidenceCount,
        localJoinedLedgerCount: localDiagnostics.joinedLedgerCount,
        remoteJoinedLedgerCount: remoteDiagnostics.joinedLedgerCount,
        convergedJoinedLedgerCount: convergedDiagnostics.joinedLedgerCount,
        localRoomKeyCount: localDiagnostics.roomKeyCount,
        remoteRoomKeyCount: remoteDiagnostics.roomKeyCount,
        convergedRoomKeyCount: convergedDiagnostics.roomKeyCount,
        localDmOutgoingCount: localDiagnostics.dmOutgoingCount,
        remoteDmOutgoingCount: remoteDiagnostics.dmOutgoingCount,
        convergedDmOutgoingCount: convergedDiagnostics.dmOutgoingCount,
      },
    });
    return {
      payload: convergedPayload,
      localDiagnostics,
      remoteDiagnostics,
      floorRequired: true,
      localLowEvidence,
      remoteHasBackup: true,
      fetchStatus: "fetched",
    };
  } catch (error) {
    logAppEvent({
      name: "account_sync.backup_publish_convergence_floor_skipped",
      level: "warn",
      scope: { feature: "account_sync", action: "backup_publish" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    return {
      payload: params.localPayload,
      localDiagnostics,
      floorRequired: true,
      localLowEvidence,
      remoteHasBackup: false,
      fetchStatus: "error",
    };
  }
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
    if (!hasPortablePrivateStateEvidence(backupPayload)) {
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
    logAppEvent({
      name: "account_sync.portable_bundle_export",
      level: "info",
      scope: { feature: "account_sync", action: "portable_bundle_export" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        payloadCreatedAtUnixMs: backupPayload.createdAtUnixMs,
        exportedAtUnixMs: bundle.exportedAtUnixMs,
        ...toPrefixedChatStateDiagnosticsContext(
          "bundle",
          summarizePersistedChatStateMessages(backupPayload.chatState, params.publicKeyHex),
        ),
      },
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
      await applyBackupPayloadNonV1Domains(params.publicKeyHex, payload, profileId, {
        restoreChatStateDomains: true,
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
    logAppEvent({
      name: "account_sync.portable_bundle_import",
      level: "info",
      scope: { feature: "account_sync", action: "portable_bundle_import" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        exportedAtUnixMs: bundle.exportedAtUnixMs,
        payloadCreatedAtUnixMs: payload.createdAtUnixMs,
        ...toPrefixedChatStateDiagnosticsContext(
          "bundle",
          summarizePersistedChatStateMessages(payload.chatState, params.publicKeyHex),
        ),
      },
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
      pool: params.pool,
    });
    const backupPayload = convergedBackupPayload.payload;
    const suppressLowEvidencePublish = convergedBackupPayload.localLowEvidence
      && (
        convergedBackupPayload.fetchStatus === "no_backup"
        || convergedBackupPayload.fetchStatus === "degraded_backup"
        || convergedBackupPayload.fetchStatus === "error"
      );
    if (suppressLowEvidencePublish) {
      accountSyncStatusStore.updateSnapshot({
        publicKeyHex: params.publicKeyHex,
        message: "Waiting for relay convergence evidence before publishing low-evidence account backup",
      });
      logAppEvent({
        name: "account_sync.backup_publish_low_evidence_suppressed",
        level: "warn",
        scope: { feature: "account_sync", action: "backup_publish" },
        context: {
          publicKeySuffix: params.publicKeyHex.slice(-8),
          fetchStatus: convergedBackupPayload.fetchStatus,
          floorRequired: convergedBackupPayload.floorRequired,
          remoteHasBackup: convergedBackupPayload.remoteHasBackup,
          localDmOutgoingCount: convergedBackupPayload.localDiagnostics.dmOutgoingCount,
          localDmIncomingCount: convergedBackupPayload.localDiagnostics.dmIncomingCount,
          localGroupEvidenceCount: convergedBackupPayload.localDiagnostics.groupEvidenceCount,
        },
      });
      return {
        publishResult: {
          status: "unsupported" as const,
          reasonCode: "low_evidence_convergence_unverified" as const,
          message: "Skipped encrypted backup publish because relay convergence could not be verified for low-evidence local state.",
        },
        envelope: null,
        backupPayload,
        signedEvent: null,
      };
    }
    if (!hasPortablePrivateStateEvidence(backupPayload)) {
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
    const plaintext = JSON.stringify(backupPayload);
    const ciphertext = await cryptoService.encryptDM(plaintext, params.publicKeyHex, params.privateKeyHex);
    const envelope = toEnvelope({
      publicKeyHex: params.publicKeyHex,
      ciphertext,
    });
    const createdAtReservation = reserveBackupEventCreatedAtUnixSeconds(
      params.publicKeyHex,
      backupPayload.createdAtUnixMs,
    );
    const unsignedEvent: UnsignedNostrEvent = {
      kind: ACCOUNT_BACKUP_EVENT_KIND,
      pubkey: params.publicKeyHex,
      created_at: createdAtReservation.createdAtUnixSeconds,
      tags: [
        ["d", ACCOUNT_BACKUP_D_TAG],
        [ACCOUNT_BACKUP_CREATED_AT_MS_TAG, String(backupPayload.createdAtUnixMs)],
      ],
      content: envelope.ciphertext,
    };
    const openRelayCount = params.pool.connections.filter((connection) => connection.status === "open").length;
    const configuredRelayCount = (params.scopedRelayUrls && params.scopedRelayUrls.length > 0)
      ? params.scopedRelayUrls.length
      : params.pool.connections.length;
    logAppEvent({
      name: "account_sync.backup_publish_ordering",
      level: "info",
      scope: { feature: "account_sync", action: "backup_publish" },
      context: {
        publicKeySuffix: params.publicKeyHex.slice(-8),
        selectionComparator: "payload_ms_then_created_at_then_event_id",
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
      },
    });
    const signedEvent = await cryptoService.signEvent(unsignedEvent, params.privateKeyHex);
    const publishResult = await publishViaRelayCore({
      pool: params.pool,
      payload: JSON.stringify(["EVENT", signedEvent]),
      scopedRelayUrls: params.scopedRelayUrls,
      waitForConnectionMs: 2_500,
    });
    const backupDeliveryStatus = publishResult.status === "ok"
      ? "sent_quorum"
      : publishResult.status === "partial"
        ? "sent_partial"
        : publishResult.status === "queued"
          ? "queued"
          : "failed";
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
      hasEncryptedBackup: publishResult.status === "ok" || publishResult.status === "partial" || publishResult.status === "queued",
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
      await applyBackupPayloadNonV1Domains(params.publicKeyHex, fetched.payload, profileId, {
        restoreChatStateDomains: true,
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
  hasPortablePrivateStateEvidence,
  compareBackupEvents,
  parseBackupCreatedAtMsTag,
  nextBackupEventCreatedAtUnixSeconds,
  resetBackupEventOrderingState: (): void => {
    lastBackupEventCreatedAtByPublicKey.clear();
  },
  fetchLatestEncryptedAccountBackupPayload: encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload,
  toEnvelope,
};
