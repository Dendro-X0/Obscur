"use client";

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import type { IdentityRecord } from "@dweb/core/identity-record";
import { MessageQueue } from "@/app/features/messaging/lib/message-queue";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import type { PersistedChatState, PersistedGroupMessage, PersistedMessage } from "@/app/features/messaging/types";
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
import {
  loadCommunityMembershipLedger,
  mergeCommunityMembershipLedgerEntries,
  parseCommunityMembershipLedgerSnapshot,
  saveCommunityMembershipLedger,
  selectJoinedCommunityMembershipLedgerEntries,
} from "@/app/features/groups/services/community-membership-ledger";
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
  RelayListSnapshot,
  RequestFlowEvidenceStateSnapshot,
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
    // For cross-device convergence, prefer relay-restored password material.
    return {
      encryptedPrivateKey: incoming.encryptedPrivateKey,
      username: incoming.username ?? current.username,
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

const uniqueStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> => Array.from(new Set(values.filter((value) => value.length > 0)));

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
  const hasDurableAcceptanceState = payload.peerTrust.acceptedPeers.length > 0
    || hasAcceptedRequestFlowEvidence(payload.requestFlowEvidence)
    || (payload.chatState?.createdConnections.length ?? 0) > 0
    || (payload.chatState?.createdGroups.length ?? 0) > 0
    || joinedCommunityCount > 0
    || hasAcceptedConnectionRequest(payload.chatState);
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

const mergePersistedMessages = (
  current: ReadonlyArray<PersistedMessage>,
  incoming: ReadonlyArray<PersistedMessage>,
): ReadonlyArray<PersistedMessage> => {
  const byId = new Map<string, PersistedMessage>();
  for (const message of [...current, ...incoming]) {
    const key = message.id;
    if (!key) {
      continue;
    }
    const existing = byId.get(key);
    if (!existing || Number(message.timestampMs ?? 0) >= Number(existing.timestampMs ?? 0)) {
      byId.set(key, message);
    }
  }
  return Array.from(byId.values()).sort((a, b) => Number(a.timestampMs ?? 0) - Number(b.timestampMs ?? 0));
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

const mergeChatState = (
  current: EncryptedAccountBackupPayload["chatState"],
  incoming: EncryptedAccountBackupPayload["chatState"]
): EncryptedAccountBackupPayload["chatState"] => {
  if (!current) {
    return incoming;
  }
  if (!incoming) {
    return current;
  }
  return {
    ...incoming,
    createdConnections: pickNewestBy(
      [...current.createdConnections, ...incoming.createdConnections],
      (value) => String(value.id ?? ""),
      (value) => Number(value.lastMessageTimeMs ?? 0)
    ),
    createdGroups: pickNewestBy(
      [...current.createdGroups, ...incoming.createdGroups],
      (value) => String(value.id ?? ""),
      (value) => Number(value.lastMessageTimeMs ?? 0)
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
  };
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
  const messageId = typeof idRaw === "string" && idRaw.trim().length > 0
    ? idRaw.trim()
    : typeof eventIdRaw === "string" && eventIdRaw.trim().length > 0
      ? eventIdRaw.trim()
      : null;
  if (!messageId) {
    return null;
  }

  const timestampMs = toTimestampMs(params.record.timestampMs)
    ?? toTimestampMs(params.record.timestamp)
    ?? toTimestampMs(params.record.eventCreatedAt)
    ?? Date.now();

  const senderPubkey = normalizePublicKeyHex(
    typeof params.record.senderPubkey === "string" ? params.record.senderPubkey : undefined
  ) ?? normalizePublicKeyHex(
    typeof params.record.pubkey === "string" ? params.record.pubkey : undefined
  );
  const recipientPubkey = normalizePublicKeyHex(
    typeof params.record.recipientPubkey === "string" ? params.record.recipientPubkey : undefined
  );

  let isOutgoing = typeof params.record.isOutgoing === "boolean"
    ? params.record.isOutgoing
    : false;
  let peerPublicKeyHex: PublicKeyHex | null = null;

  if (senderPubkey === params.myPublicKeyHex && recipientPubkey && recipientPubkey !== params.myPublicKeyHex) {
    isOutgoing = true;
    peerPublicKeyHex = recipientPubkey;
  } else if (senderPubkey === params.myPublicKeyHex) {
    isOutgoing = true;
    peerPublicKeyHex = inferPeerFromConversationId({
      conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
    });
  } else if (recipientPubkey === params.myPublicKeyHex && senderPubkey && senderPubkey !== params.myPublicKeyHex) {
    isOutgoing = false;
    peerPublicKeyHex = senderPubkey;
  } else {
    peerPublicKeyHex = inferPeerFromConversationId({
      conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
    });
  }

  const content = typeof params.record.content === "string"
    ? params.record.content
    : "";

  const kind = params.record.kind === "command" ? "command" : undefined;

  return {
    conversationId,
    persistedMessage: {
      id: messageId,
      ...(kind ? { kind } : {}),
      ...(senderPubkey ? { pubkey: senderPubkey } : {}),
      content,
      timestampMs,
      isOutgoing,
      status: normalizeMessageStatus(params.record.status),
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
  if (record.isOutgoing === true) {
    return true;
  }
  const senderPubkey = normalizePublicKeyHex(
    typeof record.senderPubkey === "string" ? record.senderPubkey : undefined
  );
  if (senderPubkey === myPublicKeyHex) {
    return true;
  }
  const messagePubkey = normalizePublicKeyHex(
    typeof record.pubkey === "string" ? record.pubkey : undefined
  );
  return messagePubkey === myPublicKeyHex;
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
  if (records.length === 0) {
    return baseState;
  }

  const messagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {
    ...baseState.messagesByConversationId,
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
  };

  const hasOutgoingHistory = getPersistedOutgoingMessageCount(nextState, publicKeyHex) > 0;
  if (!hasOutgoingHistory) {
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
            return {
              id: entry.messageId,
              content: entry.plaintextPreview,
              timestampMs: entry.eventCreatedAtUnixSeconds * 1000,
              isOutgoing,
              status: "delivered",
              pubkey: isOutgoing ? publicKeyHex : entry.peerPublicKeyHex,
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
            eventLogCount: eventLogEntries.length,
            outgoingCountAfterFallback: getPersistedOutgoingMessageCount(nextState, publicKeyHex),
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

const buildBackupPayload = (
  publicKeyHex: PublicKeyHex,
  chatStateOverride?: EncryptedAccountBackupPayload["chatState"],
): EncryptedAccountBackupPayload => {
  const profileId = getActiveProfileIdSafe();
  const communityMembershipLedger = loadCommunityMembershipLedger(publicKeyHex);
  const payload: EncryptedAccountBackupPayload = {
    version: 1,
    publicKeyHex,
    createdAtUnixMs: Date.now(),
    profile: useProfileInternals.loadFromStorage().profile,
    peerTrust: peerTrustInternals.loadFromStorage(publicKeyHex),
    requestFlowEvidence: requestFlowEvidenceStoreInternals.readState(),
    requestOutbox: contactRequestOutboxInternals.readState(),
    syncCheckpoints: Array.from(syncCheckpointInternals.loadPersistedCheckpointState().values()),
    chatState: chatStateOverride ?? chatStateStoreService.load(publicKeyHex),
    privacySettings: PrivacySettingsService.getSettings(),
    relayList: relayListInternals.loadRelayListFromStorage(publicKeyHex),
    uiSettings: buildUiSettingsSnapshot(profileId),
  };
  if (communityMembershipLedger.length === 0) {
    return payload;
  }
  return {
    ...payload,
    communityMembershipLedger,
  };
};

const buildBackupPayloadWithHydratedChatState = async (publicKeyHex: PublicKeyHex): Promise<EncryptedAccountBackupPayload> => {
  await chatStateStoreService.hydrateMessages(publicKeyHex);
  const hydratedChatState = await hydrateChatStateFromIndexedMessages(
    publicKeyHex,
    chatStateStoreService.load(publicKeyHex)
  );
  const basePayload = buildBackupPayload(publicKeyHex, hydratedChatState);
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
    chatState: parsed.chatState ?? null,
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
  if (communityMembershipLedger.length === 0) {
    return payload;
  }
  return {
    ...payload,
    communityMembershipLedger,
  };
};

const fetchLatestBackupEvent = async (
  pool: RelayPoolWithSubscribe,
  publicKeyHex: PublicKeyHex
): Promise<NostrEvent | null> => {
  await pool.waitForConnection(2_000);
  const poolEvent = await new Promise<NostrEvent | null>((resolve) => {
    const subId = `account-backup-${Math.random().toString(36).slice(2, 10)}`;
    let latestEvent: NostrEvent | null = null;
    let settled = false;
    const finish = (value: NostrEvent | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };
    const cleanup = pool.subscribeToMessages(({ message }) => {
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
            && (!latestEvent || event.created_at >= latestEvent.created_at)
          ) {
            latestEvent = event;
          }
        }
        if (parsed[0] === "EOSE") {
          finish(latestEvent);
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
    window.setTimeout(() => finish(latestEvent), BACKUP_FETCH_TIMEOUT_MS);
  });
  if (poolEvent) {
    return poolEvent;
  }
  return fetchLatestEventFromRelayUrls({
    relayUrls: getCandidateRelayUrls(pool),
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

const mergeIncomingRestorePayload = async (
  publicKeyHex: PublicKeyHex,
  payload: EncryptedAccountBackupPayload,
  options?: Readonly<{
    includeHydratedLocalMessages?: boolean;
  }>,
): Promise<EncryptedAccountBackupPayload> => {
  const sanitizedIncomingPayload: EncryptedAccountBackupPayload = hasReplayableChatHistory(payload.chatState)
    ? payload
    : {
      ...payload,
      syncCheckpoints: [],
    };
  const freshDevice = !isExistingLocalPrivateState(publicKeyHex);
  const includeHydratedLocalMessages = options?.includeHydratedLocalMessages !== false;
  const currentPayload = freshDevice
    ? null
    : includeHydratedLocalMessages
      ? await buildBackupPayloadWithHydratedChatState(publicKeyHex)
      : buildBackupPayload(publicKeyHex);
  if (currentPayload) {
    saveRecoverySnapshot(publicKeyHex, currentPayload);
  }
  const mergedCommunityMembershipLedger = (!freshDevice && currentPayload)
    ? mergeCommunityMembershipLedgerEntries(
      currentPayload.communityMembershipLedger ?? [],
      sanitizedIncomingPayload.communityMembershipLedger ?? [],
    )
    : parseCommunityMembershipLedgerSnapshot(sanitizedIncomingPayload.communityMembershipLedger);
  const mergedPayload: EncryptedAccountBackupPayload = (!freshDevice && currentPayload)
    ? {
      ...sanitizedIncomingPayload,
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
      chatState: mergeChatState(currentPayload.chatState, sanitizedIncomingPayload.chatState),
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
    }
    : (
      mergedCommunityMembershipLedger.length > 0
        ? {
          ...sanitizedIncomingPayload,
          communityMembershipLedger: mergedCommunityMembershipLedger,
        }
        : sanitizedIncomingPayload
    );
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
  if (mergedPayload.chatState) {
    // Backup restore should not immediately trigger mutation-driven backup publish.
    chatStateStoreService.replace(publicKeyHex, mergedPayload.chatState, { emitMutationSignal: false });
  }
  saveCommunityMembershipLedger(publicKeyHex, mergedPayload.communityMembershipLedger ?? []);
  PrivacySettingsService.saveSettings(mergedPayload.privacySettings);
  relayListInternals.saveRelayListToStorage(publicKeyHex, mergedPayload.relayList);
  persistUiSettingsSnapshot(profileId, mergedPayload.uiSettings);
};

const applyBackupPayloadNonV1Domains = async (
  publicKeyHex: PublicKeyHex,
  payload: EncryptedAccountBackupPayload,
  profileId = getActiveProfileIdSafe(),
): Promise<void> => {
  const mergedPayload = await mergeIncomingRestorePayload(publicKeyHex, payload, {
    includeHydratedLocalMessages: false,
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
  PrivacySettingsService.saveSettings(mergedPayload.privacySettings);
  relayListInternals.saveRelayListToStorage(publicKeyHex, mergedPayload.relayList);
  persistUiSettingsSnapshot(profileId, mergedPayload.uiSettings);
};

export const encryptedAccountBackupService = {
  buildBackupPayload,
  async publishEncryptedAccountBackup(params: Readonly<{
    publicKeyHex: PublicKeyHex;
    privateKeyHex: PrivateKeyHex;
    pool: RelayPoolLike;
    scopedRelayUrls?: ReadonlyArray<string>;
  }>) {
    const backupPayload = await buildBackupPayloadWithHydratedChatState(params.publicKeyHex);
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
    const unsignedEvent: UnsignedNostrEvent = {
      kind: ACCOUNT_BACKUP_EVENT_KIND,
      pubkey: params.publicKeyHex,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", ACCOUNT_BACKUP_D_TAG]],
      content: envelope.ciphertext,
    };
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
    const fetched = await encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload(params);
    if (!fetched.hasBackup || !fetched.payload) {
      return fetched;
    }
    const profileId = params.profileId ?? getActiveProfileIdSafe();
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
      await applyBackupPayloadNonV1Domains(params.publicKeyHex, fetched.payload, profileId);
      if (canonicalEvents.length > 0) {
        await params.appendCanonicalEvents({
          profileId,
          accountPublicKeyHex: params.publicKeyHex,
          events: canonicalEvents,
        });
      }
    } else {
      await applyBackupPayload(params.publicKeyHex, fetched.payload, profileId);
    }
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
  fetchLatestEncryptedAccountBackupPayload: encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload,
  toEnvelope,
};
