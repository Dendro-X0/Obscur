import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { EncryptedAccountBackupPayload, RoomKeySnapshot } from "../account-sync-contracts";
import {
  parseCommunityMembershipLedgerSnapshot,
  selectJoinedCommunityMembershipLedgerEntries,
} from "@/app/features/groups/services/community-membership-ledger";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { ChatStateMessageDiagnostics, MessageRecordDiagnostics } from "./restore-diagnostics";

export type BackupPayloadConvergenceDiagnostics = Readonly<{
  dmOutgoingCount: number;
  dmIncomingCount: number;
  groupConversationCount: number;
  groupMessageCount: number;
  groupSelfAuthoredCount: number;
  joinedLedgerCount: number;
  roomKeyCount: number;
  groupEvidenceCount: number;
}>;

export const parseRoomKeySnapshots = (value: unknown): ReadonlyArray<RoomKeySnapshot> => {
  if (!Array.isArray(value)) {
    return [];
  }
  const byGroupId = new Map<string, RoomKeySnapshot>();
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const candidate = entry as Partial<RoomKeySnapshot>;
    const groupId = typeof candidate.groupId === "string" ? candidate.groupId.trim() : "";
    const roomKeyHex = typeof candidate.roomKeyHex === "string" ? candidate.roomKeyHex.trim() : "";
    if (!groupId || !roomKeyHex) {
      return;
    }
    const createdAt = typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt)
      ? candidate.createdAt
      : 0;
    const current = byGroupId.get(groupId);
    if (!current || createdAt >= current.createdAt) {
      byGroupId.set(groupId, {
        groupId,
        roomKeyHex,
        createdAt,
        ...(Array.isArray(candidate.previousKeys) ? { previousKeys: candidate.previousKeys } : {}),
      });
    }
  });
  return Array.from(byGroupId.values());
};

export const summarizeBackupPayloadConvergenceDiagnostics = (params: Readonly<{
  payload: EncryptedAccountBackupPayload;
  publicKeyHex: PublicKeyHex;
  summarizeChatStateDiagnostics: (
    chatState: EncryptedAccountBackupPayload["chatState"],
    publicKeyHex: PublicKeyHex,
  ) => ChatStateMessageDiagnostics;
}>): BackupPayloadConvergenceDiagnostics => {
  const chatDiagnostics = params.summarizeChatStateDiagnostics(
    params.payload.chatState,
    params.publicKeyHex,
  );
  const joinedLedgerCount = selectJoinedCommunityMembershipLedgerEntries(
    parseCommunityMembershipLedgerSnapshot(params.payload.communityMembershipLedger),
  ).length;
  const roomKeyCount = parseRoomKeySnapshots(params.payload.roomKeys).length;
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

export const hasSparseDmOutgoingEvidenceForConvergenceFloor = (
  diagnostics: BackupPayloadConvergenceDiagnostics,
): boolean => {
  const dmMessageCount = diagnostics.dmOutgoingCount + diagnostics.dmIncomingCount;
  if (dmMessageCount < 12 || diagnostics.dmIncomingCount < 8) {
    return false;
  }
  const sparseOutgoingEvidenceThreshold = Math.max(1, Math.floor(dmMessageCount * 0.03));
  return diagnostics.dmOutgoingCount <= sparseOutgoingEvidenceThreshold;
};

export const isLowEvidenceBackupPayloadForPublish = (
  params: Readonly<{
    payload: EncryptedAccountBackupPayload;
    diagnostics: BackupPayloadConvergenceDiagnostics;
    hasReplayableChatHistory: (chatState: EncryptedAccountBackupPayload["chatState"]) => boolean;
}>,
): boolean => (
  !params.hasReplayableChatHistory(params.payload.chatState)
  && params.diagnostics.groupEvidenceCount === 0
  && params.diagnostics.dmOutgoingCount === 0
);

export const emitPublishConvergenceFloorApplied = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  applyGroupEvidenceFloor: boolean;
  applySparseDmOutgoingFloor: boolean;
  localDiagnostics: BackupPayloadConvergenceDiagnostics;
  remoteDiagnostics: BackupPayloadConvergenceDiagnostics;
  convergedDiagnostics: BackupPayloadConvergenceDiagnostics;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_publish_convergence_floor_applied",
    level: "warn",
    scope: { feature: "account_sync", action: "backup_publish" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      applyGroupEvidenceFloor: params.applyGroupEvidenceFloor,
      applySparseDmOutgoingFloor: params.applySparseDmOutgoingFloor,
      localGroupEvidenceCount: params.localDiagnostics.groupEvidenceCount,
      remoteGroupEvidenceCount: params.remoteDiagnostics.groupEvidenceCount,
      convergedGroupEvidenceCount: params.convergedDiagnostics.groupEvidenceCount,
      localJoinedLedgerCount: params.localDiagnostics.joinedLedgerCount,
      remoteJoinedLedgerCount: params.remoteDiagnostics.joinedLedgerCount,
      convergedJoinedLedgerCount: params.convergedDiagnostics.joinedLedgerCount,
      localRoomKeyCount: params.localDiagnostics.roomKeyCount,
      remoteRoomKeyCount: params.remoteDiagnostics.roomKeyCount,
      convergedRoomKeyCount: params.convergedDiagnostics.roomKeyCount,
      localDmOutgoingCount: params.localDiagnostics.dmOutgoingCount,
      remoteDmOutgoingCount: params.remoteDiagnostics.dmOutgoingCount,
      convergedDmOutgoingCount: params.convergedDiagnostics.dmOutgoingCount,
    },
  });
};

export const emitRestoreMergeDiagnostics = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  freshDevice: boolean;
  includeHydratedLocalMessages: boolean;
  shouldHydrateLocalMessages: boolean;
  canTrustIncomingPortableState: boolean;
  localPayloadMerged: boolean;
  hasHydratedLocalReplayableHistory: boolean;
  hasExplicitLocalLedgerEvidence: boolean;
  hasExplicitLocalRoomKeyEvidence: boolean;
  hasExplicitLocalMessageDeleteEvidence: boolean;
  recoverySnapshotAvailable: boolean;
  recoverySnapshotUsed: boolean;
  recoverySnapshotHasReplayableHistory: boolean;
  recoverySnapshotHasExplicitLedgerEvidence: boolean;
  recoverySnapshotHasExplicitRoomKeyEvidence: boolean;
  incomingMessageDeleteTombstoneCount: number;
  localMessageDeleteTombstoneCount: number;
  mergedMessageDeleteTombstoneCount: number;
  incomingLedgerEntryCount: number;
  incomingLedgerReconciledEntryCount: number;
  incomingLedgerJoinPromotionCount: number;
  mergedChatReconstructedLedgerEntryCount: number;
  localLedgerEntryCount: number;
  mergedLedgerEntryCount: number;
  incomingRoomKeyCount: number;
  localRoomKeyCount: number;
  mergedExplicitRoomKeyCount: number;
  mergedReconstructedRoomKeyCount: number;
  mergedRoomKeyCount: number;
  incomingChatDiagnostics: ChatStateMessageDiagnostics;
  localChatDiagnostics: ChatStateMessageDiagnostics;
  mergedChatDiagnostics: ChatStateMessageDiagnostics;
  toPrefixedChatStateDiagnosticsContext: (
    prefix: string,
    diagnostics: ChatStateMessageDiagnostics,
  ) => Record<string, unknown>;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_restore_merge_diagnostics",
    level: "info",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      freshDevice: params.freshDevice,
      includeHydratedLocalMessages: params.includeHydratedLocalMessages,
      shouldHydrateLocalMessages: params.shouldHydrateLocalMessages,
      canTrustIncomingPortableState: params.canTrustIncomingPortableState,
      localPayloadMerged: params.localPayloadMerged,
      hasHydratedLocalReplayableHistory: params.hasHydratedLocalReplayableHistory,
      hasExplicitLocalLedgerEvidence: params.hasExplicitLocalLedgerEvidence,
      hasExplicitLocalRoomKeyEvidence: params.hasExplicitLocalRoomKeyEvidence,
      hasExplicitLocalMessageDeleteEvidence: params.hasExplicitLocalMessageDeleteEvidence,
      recoverySnapshotAvailable: params.recoverySnapshotAvailable,
      recoverySnapshotUsed: params.recoverySnapshotUsed,
      recoverySnapshotHasReplayableHistory: params.recoverySnapshotHasReplayableHistory,
      recoverySnapshotHasExplicitLedgerEvidence: params.recoverySnapshotHasExplicitLedgerEvidence,
      recoverySnapshotHasExplicitRoomKeyEvidence: params.recoverySnapshotHasExplicitRoomKeyEvidence,
      incomingMessageDeleteTombstoneCount: params.incomingMessageDeleteTombstoneCount,
      localMessageDeleteTombstoneCount: params.localMessageDeleteTombstoneCount,
      mergedMessageDeleteTombstoneCount: params.mergedMessageDeleteTombstoneCount,
      incomingLedgerEntryCount: params.incomingLedgerEntryCount,
      incomingLedgerReconciledEntryCount: params.incomingLedgerReconciledEntryCount,
      mergedChatReconstructedLedgerEntryCount: params.mergedChatReconstructedLedgerEntryCount,
      incomingLedgerJoinPromotionCount: params.incomingLedgerJoinPromotionCount,
      localLedgerEntryCount: params.localLedgerEntryCount,
      mergedLedgerEntryCount: params.mergedLedgerEntryCount,
      incomingRoomKeyCount: params.incomingRoomKeyCount,
      localRoomKeyCount: params.localRoomKeyCount,
      mergedExplicitRoomKeyCount: params.mergedExplicitRoomKeyCount,
      mergedReconstructedRoomKeyCount: params.mergedReconstructedRoomKeyCount,
      mergedRoomKeyCount: params.mergedRoomKeyCount,
      ...params.toPrefixedChatStateDiagnosticsContext("incoming", params.incomingChatDiagnostics),
      ...params.toPrefixedChatStateDiagnosticsContext("local", params.localChatDiagnostics),
      ...params.toPrefixedChatStateDiagnosticsContext("merged", params.mergedChatDiagnostics),
    },
  });
};

export const emitPublishConvergenceFloorSkipped = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  reason: string;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_publish_convergence_floor_skipped",
    level: "warn",
    scope: { feature: "account_sync", action: "backup_publish" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      reason: params.reason,
    },
  });
};

export const emitBackupPayloadProjectionFallback = (params: Readonly<{
  profileId: string;
  reasonNoOutgoingHistory: boolean;
  reasonSparseOutgoingEvidence: boolean;
  reasonOutgoingOnlyConversationSkew: boolean;
  reasonIncomingOnlyConversationSkew: boolean;
  sparseOutgoingEvidenceThreshold: number;
  eventLogCount: number;
  outgoingCountBeforeFallback: number;
  outgoingCountAfterFallback: number;
  sourceRecordCount: number;
  sourceOutgoingRecordCount: number;
  sourceIncomingRecordCount: number;
  sourceIncomingOnlyRawConversationCount: number;
  sourceOutgoingOnlyRawConversationCount: number;
  indexedRecordCount: number;
  queueRecordCount: number;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_payload_projection_fallback",
    level: "info",
    scope: { feature: "account_sync", action: "backup_publish" },
    context: {
      profileId: params.profileId,
      reasonNoOutgoingHistory: params.reasonNoOutgoingHistory,
      reasonSparseOutgoingEvidence: params.reasonSparseOutgoingEvidence,
      reasonOutgoingOnlyConversationSkew: params.reasonOutgoingOnlyConversationSkew,
      reasonIncomingOnlyConversationSkew: params.reasonIncomingOnlyConversationSkew,
      sparseOutgoingEvidenceThreshold: params.sparseOutgoingEvidenceThreshold,
      eventLogCount: params.eventLogCount,
      outgoingCountBeforeFallback: params.outgoingCountBeforeFallback,
      outgoingCountAfterFallback: params.outgoingCountAfterFallback,
      sourceRecordCount: params.sourceRecordCount,
      sourceOutgoingRecordCount: params.sourceOutgoingRecordCount,
      sourceIncomingRecordCount: params.sourceIncomingRecordCount,
      sourceIncomingOnlyRawConversationCount: params.sourceIncomingOnlyRawConversationCount,
      sourceOutgoingOnlyRawConversationCount: params.sourceOutgoingOnlyRawConversationCount,
      indexedRecordCount: params.indexedRecordCount,
      queueRecordCount: params.queueRecordCount,
    },
  });
};

export const emitBackupPayloadProjectionFallbackFailed = (params: Readonly<{
  reason: string;
  indexedRecordCount: number;
  queueRecordCount: number;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_payload_projection_fallback_failed",
    level: "warn",
    scope: { feature: "account_sync", action: "backup_publish" },
    context: {
      reason: params.reason,
      indexedRecordCount: params.indexedRecordCount,
      queueRecordCount: params.queueRecordCount,
    },
  });
};

export const emitBackupPayloadHydrationDiagnostics = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  indexedRecordCount: number;
  queueRecordCount: number;
  shouldScanQueueRecords: boolean;
  convergenceGuardEnabled: boolean;
  hasIndexedConversationWithoutOutgoingEvidence: boolean;
  recordDiagnostics: MessageRecordDiagnostics;
  hydratedChatStateDiagnostics: ChatStateMessageDiagnostics;
  toPrefixedRecordDiagnosticsContext: (
    prefix: string,
    diagnostics: MessageRecordDiagnostics,
  ) => Record<string, unknown>;
  toPrefixedChatStateDiagnosticsContext: (
    prefix: string,
    diagnostics: ChatStateMessageDiagnostics,
  ) => Record<string, unknown>;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_payload_hydration_diagnostics",
    level: "info",
    scope: { feature: "account_sync", action: "backup_publish" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      indexedRecordCount: params.indexedRecordCount,
      queueRecordCount: params.queueRecordCount,
      shouldScanQueueRecords: params.shouldScanQueueRecords,
      convergenceGuardEnabled: params.convergenceGuardEnabled,
      hasIndexedConversationWithoutOutgoingEvidence: params.hasIndexedConversationWithoutOutgoingEvidence,
      ...params.toPrefixedRecordDiagnosticsContext("source", params.recordDiagnostics),
      ...params.toPrefixedChatStateDiagnosticsContext("hydrated", params.hydratedChatStateDiagnostics),
    },
  });
};

export const emitBackupRestoreApplyDiagnostics = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  restorePath: string;
  appliedRoomKeyCount: number;
  appliedMessageDeleteTombstoneCount: number;
  appliedChatDiagnostics: ChatStateMessageDiagnostics;
  toPrefixedChatStateDiagnosticsContext: (
    prefix: string,
    diagnostics: ChatStateMessageDiagnostics,
  ) => Record<string, unknown>;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_restore_apply_diagnostics",
    level: "info",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      restorePath: params.restorePath,
      appliedRoomKeyCount: params.appliedRoomKeyCount,
      appliedMessageDeleteTombstoneCount: params.appliedMessageDeleteTombstoneCount,
      ...params.toPrefixedChatStateDiagnosticsContext("applied", params.appliedChatDiagnostics),
    },
  });
};

export const emitBackupPublishLowEvidenceSuppressed = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  fetchStatus: string;
  floorRequired: boolean;
  remoteHasBackup: boolean;
  localDmOutgoingCount: number;
  localDmIncomingCount: number;
  localGroupEvidenceCount: number;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_publish_low_evidence_suppressed",
    level: "warn",
    scope: { feature: "account_sync", action: "backup_publish" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      fetchStatus: params.fetchStatus,
      floorRequired: params.floorRequired,
      remoteHasBackup: params.remoteHasBackup,
      localDmOutgoingCount: params.localDmOutgoingCount,
      localDmIncomingCount: params.localDmIncomingCount,
      localGroupEvidenceCount: params.localGroupEvidenceCount,
    },
  });
};

export const emitBackupPublishOrdering = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  payloadCreatedAtUnixMs: number;
  payloadCreatedAtUnixSeconds: number;
  eventCreatedAtUnixSeconds: number;
  previousEventCreatedAtUnixSeconds: number | null;
  createdAtAdjustmentSeconds: number;
  monotonicBumpApplied: boolean;
  configuredRelayCount: number;
  openRelayCount: number;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_publish_ordering",
    level: "info",
    scope: { feature: "account_sync", action: "backup_publish" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      selectionComparator: "payload_ms_then_created_at_then_event_id",
      payloadCreatedAtUnixMs: params.payloadCreatedAtUnixMs,
      payloadCreatedAtUnixSeconds: params.payloadCreatedAtUnixSeconds,
      eventCreatedAtUnixSeconds: params.eventCreatedAtUnixSeconds,
      previousEventCreatedAtUnixSeconds: params.previousEventCreatedAtUnixSeconds,
      createdAtAdjustmentSeconds: params.createdAtAdjustmentSeconds,
      monotonicBumpApplied: params.monotonicBumpApplied,
      configuredRelayCount: params.configuredRelayCount,
      openRelayCount: params.openRelayCount,
    },
  });
};

export const emitPortableBundleExport = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  payloadCreatedAtUnixMs: number;
  exportedAtUnixMs: number;
  bundleChatDiagnostics: ChatStateMessageDiagnostics;
  toPrefixedChatStateDiagnosticsContext: (
    prefix: string,
    diagnostics: ChatStateMessageDiagnostics,
  ) => Record<string, unknown>;
}>): void => {
  logAppEvent({
    name: "account_sync.portable_bundle_export",
    level: "info",
    scope: { feature: "account_sync", action: "portable_bundle_export" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      payloadCreatedAtUnixMs: params.payloadCreatedAtUnixMs,
      exportedAtUnixMs: params.exportedAtUnixMs,
      ...params.toPrefixedChatStateDiagnosticsContext("bundle", params.bundleChatDiagnostics),
    },
  });
};

export const emitPortableBundleImport = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  exportedAtUnixMs: number;
  payloadCreatedAtUnixMs: number;
  bundleChatDiagnostics: ChatStateMessageDiagnostics;
  toPrefixedChatStateDiagnosticsContext: (
    prefix: string,
    diagnostics: ChatStateMessageDiagnostics,
  ) => Record<string, unknown>;
}>): void => {
  logAppEvent({
    name: "account_sync.portable_bundle_import",
    level: "info",
    scope: { feature: "account_sync", action: "portable_bundle_import" },
    context: {
      publicKeySuffix: params.publicKeyHex.slice(-8),
      exportedAtUnixMs: params.exportedAtUnixMs,
      payloadCreatedAtUnixMs: params.payloadCreatedAtUnixMs,
      ...params.toPrefixedChatStateDiagnosticsContext("bundle", params.bundleChatDiagnostics),
    },
  });
};

export const emitIdentityUnlockConflictPreservedLocal = (params: Readonly<{
  localUsernamePresent: boolean;
  incomingUsernamePresent: boolean;
}>): void => {
  logAppEvent({
    name: "account_sync.identity_unlock_conflict_preserved_local",
    level: "warn",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      localUsernamePresent: params.localUsernamePresent,
      incomingUsernamePresent: params.incomingUsernamePresent,
    },
  });
};

export const emitRestoreDeleteTargetUnresolved = (params: Readonly<{
  messageCount: number;
  commandMessageCount: number;
  deleteTargetCount: number;
  unresolvedDeleteTargetCount: number;
  unresolvedDeleteTargetSample: string;
}>): void => {
  logAppEvent({
    name: "account_sync.backup_restore_delete_target_unresolved",
    level: "warn",
    scope: { feature: "account_sync", action: "backup_restore" },
    context: {
      messageCount: params.messageCount,
      commandMessageCount: params.commandMessageCount,
      deleteTargetCount: params.deleteTargetCount,
      unresolvedDeleteTargetCount: params.unresolvedDeleteTargetCount,
      unresolvedDeleteTargetSample: params.unresolvedDeleteTargetSample,
    },
  });
};
