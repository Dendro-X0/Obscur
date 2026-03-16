import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import type { PersistedChatState } from "@/app/features/messaging/types";
import type { RequestFlowEvidence } from "@/app/features/messaging/services/request-flow-contracts";
import type { ContactRequestRecord } from "@/app/features/search/types/discovery";
import type { UserProfile } from "@/app/features/profile/hooks/use-profile";
import type { LocalMediaStorageConfig } from "@/app/features/vault/services/local-media-store";

export type CanonicalAccountId = PublicKeyHex;

export type AccountRestoreStatus = "identity_only" | "public_restored" | "private_restored" | "degraded";
export type AccountPortabilityStatus = "unknown" | "local_only" | "profile_only" | "portable" | "degraded";

export type AccountSyncBackupPublishReason =
  | "startup"
  | "interval"
  | "visible"
  | "pagehide"
  | "mutation";

export type AccountSyncBackupRestoreReason =
  | "startup_fast_follow"
  | "mutation_fast_follow"
  | "interval"
  | "visible"
  | "follow_up";

export type AccountSyncBackupPublishResult =
  | "ok"
  | "partial"
  | "queued"
  | "failed"
  | "unsupported"
  | "error"
  | "skipped_identity"
  | "in_flight"
  | "skipped_cooldown";

export type AccountSyncBackupRestoreResult =
  | "applied"
  | "no_backup"
  | "degraded"
  | "failed"
  | "skipped_identity"
  | "in_flight"
  | "skipped_cooldown";

export type AccountSyncPhase =
  | "idle"
  | "found_account"
  | "restoring_profile"
  | "restoring_account_data"
  | "syncing_messages_and_requests"
  | "ready"
  | "error";

export type StoredPeerTrustSnapshot = Readonly<{
  acceptedPeers: ReadonlyArray<PublicKeyHex>;
  mutedPeers: ReadonlyArray<PublicKeyHex>;
}>;

export type RequestFlowEvidenceStateSnapshot = Readonly<{
  byPeer: Readonly<Record<string, RequestFlowEvidence>>;
}>;

export type ContactRequestOutboxSnapshot = Readonly<{
  records: ReadonlyArray<ContactRequestRecord>;
}>;

export type SyncCheckpointSnapshot = ReadonlyArray<Readonly<{
  timelineKey: string;
  lastProcessedAtUnixSeconds: number;
  updatedAtUnixMs: number;
}>>;

export type RelayListSnapshot = ReadonlyArray<Readonly<{
  url: string;
  enabled: boolean;
}>>;

export type ThemePreferenceSnapshot = "system" | "light" | "dark";

export type AccessibilityPreferencesSnapshot = Readonly<{
  textScale: 90 | 100 | 110 | 120;
  reducedMotion: boolean;
  contrastAssist: boolean;
}>;

export type UiSettingsSnapshot = Readonly<{
  themePreference: ThemePreferenceSnapshot;
  accessibilityPreferences: AccessibilityPreferencesSnapshot;
  localMediaStorageConfig: LocalMediaStorageConfig;
}>;

export type IdentityUnlockSnapshot = Readonly<{
  encryptedPrivateKey: string;
  username?: string;
}>;

export type EncryptedAccountBackupPayload = Readonly<{
  version: 1;
  publicKeyHex: PublicKeyHex;
  createdAtUnixMs: number;
  identityUnlock?: IdentityUnlockSnapshot;
  profile: UserProfile;
  peerTrust: StoredPeerTrustSnapshot;
  requestFlowEvidence: RequestFlowEvidenceStateSnapshot;
  requestOutbox: ContactRequestOutboxSnapshot;
  syncCheckpoints: SyncCheckpointSnapshot;
  chatState: PersistedChatState | null;
  privacySettings: PrivacySettings;
  relayList: RelayListSnapshot;
  uiSettings?: UiSettingsSnapshot;
}>;

export type EncryptedAccountBackupEnvelope = Readonly<{
  version: 1;
  publicKeyHex: PublicKeyHex;
  createdAtUnixMs: number;
  ciphertext: string;
  backupEventKind: number;
  dTag: string;
}>;

export type RelayRehydrateProfile = Readonly<{
  publicKeyHex: PublicKeyHex;
  username: string;
  about: string;
  avatarUrl: string;
  nip05: string;
  inviteCode: string;
  sourceEventId: string;
  updatedAtUnixMs: number;
}>;

export type AccountRehydrateReport = Readonly<{
  publicProfile: RelayRehydrateProfile | null;
  relayList: RelayListSnapshot;
  restoreStatus: AccountRestoreStatus;
  restoredBackupAtUnixMs?: number;
  latestBackupEventId?: string;
  latestProfileEventId?: string;
  latestRelayListEventId?: string;
  degradedReason?: string;
}>;

export type AccountSyncSnapshot = Readonly<{
  publicKeyHex: PublicKeyHex | null;
  status: AccountRestoreStatus;
  portabilityStatus: AccountPortabilityStatus;
  phase: AccountSyncPhase;
  message: string;
  lastPublicProfileFetchAtUnixMs?: number;
  lastEncryptedBackupRestoreAtUnixMs?: number;
  lastEncryptedBackupPublishAtUnixMs?: number;
  hasEncryptedBackup?: boolean;
  lastRelayFailureReason?: string;
  latestProfileEventId?: string;
  latestBackupEventId?: string;
  lastRestoreSource?: "relay_profile" | "encrypted_backup" | "local_draft_only";
  lastImportEvidence?: Readonly<{
    localBinding: boolean;
    relayProfileEventSeen: boolean;
    relayBackupEventSeen: boolean;
    checkedAtUnixMs: number;
  }>;
  profileProof?: Readonly<{
    eventId?: string;
    deliveryStatus: "sent_quorum" | "sent_partial" | "queued" | "failed" | "unknown";
    successCount?: number;
    totalRelays?: number;
    message?: string;
    updatedAtUnixMs: number;
  }>;
  backupProof?: Readonly<{
    eventId?: string;
    deliveryStatus: "sent_quorum" | "sent_partial" | "queued" | "failed" | "unknown";
    successCount?: number;
    totalRelays?: number;
    message?: string;
    updatedAtUnixMs: number;
  }>;
  convergenceDiagnostics?: Readonly<{
    guardEnabled: boolean;
    lastBackupPublishReason?: AccountSyncBackupPublishReason;
    lastBackupPublishAttemptAtUnixMs?: number;
    lastBackupPublishResult?: AccountSyncBackupPublishResult;
    lastBackupRestoreReason?: AccountSyncBackupRestoreReason;
    lastBackupRestoreAttemptAtUnixMs?: number;
    lastBackupRestoreResult?: AccountSyncBackupRestoreResult;
    lastMutationPublishAtUnixMs?: number;
    lastMutationRestoreAtUnixMs?: number;
    lastMutationConvergenceLatencyMs?: number;
  }>;
}>;

export type AccountBackupFetchResult = Readonly<{
  event: NostrEvent | null;
  payload: EncryptedAccountBackupPayload | null;
  hasBackup: boolean;
  degradedReason?: string;
}>;

export const ACCOUNT_BACKUP_EVENT_KIND = 30078;
export const ACCOUNT_BACKUP_D_TAG = "obscur-account-backup";
