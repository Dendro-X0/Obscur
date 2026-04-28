import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { CanonicalBackupRestoreOwnerSelection } from "./restore-import-contracts";

export type ChatStateMessageDiagnostics = Readonly<{
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

export type MessageRecordDiagnostics = Readonly<{
  recordCount: number;
  rawConversationCount: number;
  canonicalConversationCount: number;
  canonicalConversationIdMismatchCount: number;
  canonicalCollisionCount: number;
  canonicalCollisionSample: string | null;
  outgoingRecordCount: number;
  incomingRecordCount: number;
  incomingOnlyRawConversationCount: number;
  outgoingOnlyRawConversationCount: number;
}>;

export const EMPTY_CHAT_STATE_MESSAGE_DIAGNOSTICS: ChatStateMessageDiagnostics = {
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

export const EMPTY_MESSAGE_RECORD_DIAGNOSTICS: MessageRecordDiagnostics = {
  recordCount: 0,
  rawConversationCount: 0,
  canonicalConversationCount: 0,
  canonicalConversationIdMismatchCount: 0,
  canonicalCollisionCount: 0,
  canonicalCollisionSample: null,
  outgoingRecordCount: 0,
  incomingRecordCount: 0,
  incomingOnlyRawConversationCount: 0,
  outgoingOnlyRawConversationCount: 0,
};

export const toPrefixedChatStateDiagnosticsContext = (
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

export const toPrefixedRecordDiagnosticsContext = (
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
  [`${prefix}OutgoingOnlyRawConversationCount`]: diagnostics.outgoingOnlyRawConversationCount,
});

export type BackupSelectionSource = "pool" | "direct" | "none";

export type BackupSelectionDiagnostics = Readonly<{
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

export const emitBackupRestoreSelectionDiagnostics = (params: Readonly<{
  diagnostics: BackupSelectionDiagnostics;
  parseBackupCreatedAtMsTag: (event: NostrEvent) => number | null;
}>): void => {
  const selectedPayloadCreatedAtUnixMs = params.diagnostics.selectedEvent
    ? params.parseBackupCreatedAtMsTag(params.diagnostics.selectedEvent)
    : null;
  logAppEvent({
    name: "account_sync.backup_restore_selection",
    level: "info",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      source: params.diagnostics.source,
      selectionComparator: "payload_ms_then_created_at_then_event_id",
      publicKeySuffix: params.diagnostics.publicKeyHex.slice(-8),
      poolOpenRelayCount: params.diagnostics.poolOpenRelayCount,
      poolExpectedEoseRelayCount: params.diagnostics.poolExpectedEoseRelayCount,
      poolReceivedEoseRelayCount: params.diagnostics.poolReceivedEoseRelayCount,
      poolCandidateCount: params.diagnostics.poolCandidateCount,
      poolTimedOut: params.diagnostics.poolTimedOut,
      fallbackRelayCount: params.diagnostics.fallbackRelayCount,
      selectedEventId: params.diagnostics.selectedEvent?.id ?? null,
      selectedEventCreatedAtUnixSeconds: params.diagnostics.selectedEvent?.created_at ?? null,
      selectedPayloadCreatedAtUnixMs,
    },
  });
};

export type BackupRestoreProfileScopeMismatchReasonCode =
  | "requested_profile_not_active"
  | "active_profile_changed_during_restore"
  | "active_profile_changed_after_apply";

export type BackupRestoreProfileScopeDiagnostics = Readonly<{
  publicKeyHex: PublicKeyHex;
  backupEventId: string | null;
  requestedProfileId: string | null;
  effectiveProfileId: string;
  activeProfileIdAtRestoreStart: string;
  activeProfileIdBeforeApply: string;
  activeProfileIdAfterApply: string;
  hasCanonicalAppender: boolean;
}>;

export const resolveBackupRestoreProfileScopeMismatchReasonCode = (
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

export const maybeEmitBackupRestoreProfileScopeMismatch = (
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

export const emitBackupRestoreOwnerSelection = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  restoreSource: "portable_bundle" | "encrypted_backup";
  canonicalEventCount: number;
  selection: CanonicalBackupRestoreOwnerSelection;
  payloadDiagnostics: ChatStateMessageDiagnostics;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_restore_owner_selection",
    level: params.selection.restoreDmChatStateDomains ? "info" : "warn",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      profileId: params.profileId,
      restoreSource: params.restoreSource,
      canonicalEventCount: params.canonicalEventCount,
      migrationPhase: params.selection.migrationPhase,
      selectedDmHistoryOwner: params.selection.dmHistoryOwner,
      selectedDmHistoryOwnerReason: params.selection.reason,
      restoreDmChatStateDomains: params.selection.restoreDmChatStateDomains,
      ...toPrefixedChatStateDiagnosticsContext("payload", params.payloadDiagnostics),
    },
  });
};

export type BackupRestoreHistoryRegressionStage =
  | "incoming_to_merged"
  | "merged_to_applied_store"
  | "post_apply_to_post_canonical_append";

export const maybeEmitBackupRestoreHistoryRegression = (params: Readonly<{
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
