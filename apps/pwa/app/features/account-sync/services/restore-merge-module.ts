import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { EncryptedAccountBackupPayload } from "../account-sync-contracts";
import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";
import type { RoomKeySnapshot } from "../account-sync-contracts";
import type {
  ChatStateMessageDiagnostics,
} from "./restore-diagnostics";
import {
  mergeChatState,
  mergeMessageDeleteTombstones,
  sanitizePersistedChatStateMessagesByDeleteContract,
  toMessageDeleteTombstoneIdSet,
} from "./restore-merge-chat-state";
import {
  parseCommunityMembershipLedgerSnapshot,
  mergeCommunityMembershipLedgerEntries,
} from "@/app/features/groups/services/community-membership-ledger";
import {
  reconstructCommunityMembershipFromChatState,
  supplementMembershipLedgerEntries,
} from "@/app/features/groups/services/community-membership-reconstruction";
import {
  emitRestoreMergeDiagnostics,
  emitBackupRestoreApplyDiagnostics,
  emitBackupPublishLowEvidenceSuppressed,
  summarizeBackupPayloadConvergenceDiagnostics,
  parseRoomKeySnapshots,
  type BackupPayloadConvergenceDiagnostics,
} from "./restore-merge-diagnostics";
import {
  shouldSuppressBackupPublish,
  buildSuppressedPublishResult,
  hasPortablePrivateStateEvidence,
  type BackupPublishSuppressionResult,
} from "./restore-merge-policy";
import { accountSyncStatusStore } from "./account-sync-status-store";

export type MergeDiagnosticsContext = Readonly<{
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
  incomingMessageDeleteTombstones: ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>;
  localMessageDeleteTombstones: ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>;
  mergedMessageDeleteTombstones: ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>;
  incomingLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  reconciledIncomingLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  reconstructedMergedLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  localExplicitLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  mergedCommunityMembershipLedger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  incomingRoomKeySnapshots: ReadonlyArray<RoomKeySnapshot>;
  localExplicitRoomKeySnapshots: ReadonlyArray<RoomKeySnapshot>;
  mergedExplicitRoomKeys: ReadonlyArray<RoomKeySnapshot>;
  reconstructedMergedRoomKeySnapshots: ReadonlyArray<RoomKeySnapshot>;
  mergedRoomKeys: ReadonlyArray<RoomKeySnapshot>;
  incomingPayload: EncryptedAccountBackupPayload;
  currentPayload: EncryptedAccountBackupPayload | null;
  mergedPayload: EncryptedAccountBackupPayload;
  summarizeChatStateDiagnostics: (
    chatState: EncryptedAccountBackupPayload["chatState"],
    publicKeyHex: PublicKeyHex,
  ) => ChatStateMessageDiagnostics;
  toPrefixedChatStateDiagnosticsContext: (
    prefix: string,
    diagnostics: ChatStateMessageDiagnostics,
  ) => Record<string, unknown>;
}>;

export const emitMergeCompletionDiagnostics = (context: MergeDiagnosticsContext): void => {
  const incomingChatDiagnostics = context.summarizeChatStateDiagnostics(
    context.incomingPayload.chatState,
    context.publicKeyHex,
  );
  const localChatDiagnostics = context.summarizeChatStateDiagnostics(
    context.currentPayload?.chatState ?? null,
    context.publicKeyHex,
  );
  const mergedChatDiagnostics = context.summarizeChatStateDiagnostics(
    context.mergedPayload.chatState,
    context.publicKeyHex,
  );

  const incomingLedgerJoinPromotionCount = context.reconciledIncomingLedgerEntries.reduce(
    (count, entry, index) => {
      const incomingEntry = context.incomingLedgerEntries[index];
      if (!incomingEntry) {
        return count;
      }
      return incomingEntry.status !== "joined" && entry.status === "joined"
        ? count + 1
        : count;
    },
    0,
  );

  emitRestoreMergeDiagnostics({
    publicKeyHex: context.publicKeyHex,
    freshDevice: context.freshDevice,
    includeHydratedLocalMessages: context.includeHydratedLocalMessages,
    shouldHydrateLocalMessages: context.shouldHydrateLocalMessages,
    canTrustIncomingPortableState: context.canTrustIncomingPortableState,
    localPayloadMerged: context.localPayloadMerged,
    hasHydratedLocalReplayableHistory: context.hasHydratedLocalReplayableHistory,
    hasExplicitLocalLedgerEvidence: context.hasExplicitLocalLedgerEvidence,
    hasExplicitLocalRoomKeyEvidence: context.hasExplicitLocalRoomKeyEvidence,
    hasExplicitLocalMessageDeleteEvidence: context.hasExplicitLocalMessageDeleteEvidence,
    recoverySnapshotAvailable: context.recoverySnapshotAvailable,
    recoverySnapshotUsed: context.recoverySnapshotUsed,
    recoverySnapshotHasReplayableHistory: context.recoverySnapshotHasReplayableHistory,
    recoverySnapshotHasExplicitLedgerEvidence: context.recoverySnapshotHasExplicitLedgerEvidence,
    recoverySnapshotHasExplicitRoomKeyEvidence: context.recoverySnapshotHasExplicitRoomKeyEvidence,
    incomingMessageDeleteTombstoneCount: context.incomingMessageDeleteTombstones.length,
    localMessageDeleteTombstoneCount: context.localMessageDeleteTombstones.length,
    mergedMessageDeleteTombstoneCount: context.mergedMessageDeleteTombstones.length,
    incomingLedgerEntryCount: context.incomingLedgerEntries.length,
    incomingLedgerReconciledEntryCount: context.reconciledIncomingLedgerEntries.length,
    incomingLedgerJoinPromotionCount,
    mergedChatReconstructedLedgerEntryCount: context.reconstructedMergedLedgerEntries.length,
    localLedgerEntryCount: context.localExplicitLedgerEntries.length,
    mergedLedgerEntryCount: context.mergedCommunityMembershipLedger.length,
    incomingRoomKeyCount: context.incomingRoomKeySnapshots.length,
    localRoomKeyCount: context.localExplicitRoomKeySnapshots.length,
    mergedExplicitRoomKeyCount: context.mergedExplicitRoomKeys.length,
    mergedReconstructedRoomKeyCount: context.reconstructedMergedRoomKeySnapshots.length,
    mergedRoomKeyCount: context.mergedRoomKeys.length,
    incomingChatDiagnostics,
    localChatDiagnostics,
    mergedChatDiagnostics,
    toPrefixedChatStateDiagnosticsContext: context.toPrefixedChatStateDiagnosticsContext,
  });
};

export type ApplyDiagnosticsContext = Readonly<{
  publicKeyHex: PublicKeyHex;
  mergedPayload: EncryptedAccountBackupPayload;
  restorePath: string;
  summarizeChatStateDiagnostics: (
    chatState: EncryptedAccountBackupPayload["chatState"],
    publicKeyHex: PublicKeyHex,
  ) => ChatStateMessageDiagnostics;
  toPrefixedChatStateDiagnosticsContext: (
    prefix: string,
    diagnostics: ChatStateMessageDiagnostics,
  ) => Record<string, unknown>;
  parseRoomKeySnapshots: (
    entries: EncryptedAccountBackupPayload["roomKeys"],
  ) => ReadonlyArray<RoomKeySnapshot>;
}>;

export const emitApplyCompletionDiagnostics = (context: ApplyDiagnosticsContext): void => {
  const appliedChatDiagnostics = context.summarizeChatStateDiagnostics(
    context.mergedPayload.chatState,
    context.publicKeyHex,
  );

  emitBackupRestoreApplyDiagnostics({
    publicKeyHex: context.publicKeyHex,
    restorePath: context.restorePath,
    appliedRoomKeyCount: context.parseRoomKeySnapshots(context.mergedPayload.roomKeys).length,
    appliedMessageDeleteTombstoneCount: context.mergedPayload.messageDeleteTombstones?.length ?? 0,
    appliedChatDiagnostics,
    toPrefixedChatStateDiagnosticsContext: context.toPrefixedChatStateDiagnosticsContext,
  });
};

export type PublishConvergenceContext = Readonly<{
  publicKeyHex: PublicKeyHex;
  payload: EncryptedAccountBackupPayload;
  fetchStatus: import("./restore-merge-policy").BackupPublishConvergenceFetchStatus;
  floorRequired: boolean;
  remoteHasBackup: boolean;
  localLowEvidence: boolean;
  localDiagnostics: BackupPayloadConvergenceDiagnostics;
  remoteDiagnostics?: BackupPayloadConvergenceDiagnostics;
  hasReplayableChatHistory: (chatState: EncryptedAccountBackupPayload["chatState"]) => boolean;
}>;

export type PublishConvergenceResult =
  | Readonly<{ action: "proceed"; payload: EncryptedAccountBackupPayload }>
  | Readonly<{ action: "suppress"; result: BackupPublishSuppressionResult }>;

export const evaluatePublishConvergenceOutcome = (
  context: PublishConvergenceContext,
): PublishConvergenceResult => {
  if (shouldSuppressBackupPublish(context)) {
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: context.publicKeyHex,
      message: "Waiting for relay convergence evidence before publishing low-evidence account backup",
    });

    emitBackupPublishLowEvidenceSuppressed({
      publicKeyHex: context.publicKeyHex,
      fetchStatus: context.fetchStatus,
      floorRequired: context.floorRequired,
      remoteHasBackup: context.remoteHasBackup,
      localDmOutgoingCount: context.localDiagnostics.dmOutgoingCount,
      localDmIncomingCount: context.localDiagnostics.dmIncomingCount,
      localGroupEvidenceCount: context.localDiagnostics.groupEvidenceCount,
    });

    const suppressionResult = buildSuppressedPublishResult({
      convergedResult: context,
      reason: "low_evidence_convergence_unverified",
      message:
        "Skipped encrypted backup publish because relay convergence could not be verified for low-evidence local state.",
    });

    return { action: "suppress", result: suppressionResult };
  }

  return { action: "proceed", payload: context.payload };
};

export type PortableStateValidationContext = Readonly<{
  payload: EncryptedAccountBackupPayload;
  hasReplayableChatHistory: (chatState: EncryptedAccountBackupPayload["chatState"]) => boolean;
}>;

export const validatePortablePrivateStateEvidence = (
  context: PortableStateValidationContext,
): boolean => hasPortablePrivateStateEvidence(context.payload, context.hasReplayableChatHistory);

export type ConvergenceDiagnosticsContext = Readonly<{
  payload: EncryptedAccountBackupPayload;
  publicKeyHex: PublicKeyHex;
  summarizeChatStateDiagnostics: (
    chatState: EncryptedAccountBackupPayload["chatState"],
    publicKeyHex: PublicKeyHex,
  ) => ChatStateMessageDiagnostics;
}>;

export const buildConvergenceDiagnostics = (
  context: ConvergenceDiagnosticsContext,
): BackupPayloadConvergenceDiagnostics =>
  summarizeBackupPayloadConvergenceDiagnostics({
    payload: context.payload,
    publicKeyHex: context.publicKeyHex,
    summarizeChatStateDiagnostics: context.summarizeChatStateDiagnostics,
  });

/**
 * Room key snapshot functions - extracted from encrypted-account-backup-service.ts
 * to centralize merge orchestration logic in the restore merge module.
 */

export const mergeRoomKeySnapshots = (
  localRoomKeys: ReadonlyArray<RoomKeySnapshot>,
  incomingRoomKeys: ReadonlyArray<RoomKeySnapshot>,
): ReadonlyArray<RoomKeySnapshot> => {
  const byGroupId = new Map<string, RoomKeySnapshot>();

  for (const roomKey of localRoomKeys) {
    const normalizedId = roomKey.groupId.trim();
    const existing = byGroupId.get(normalizedId);
    if (!existing || (roomKey.createdAt ?? 0) > (existing.createdAt ?? 0)) {
      byGroupId.set(normalizedId, roomKey);
    }
  }

  for (const roomKey of incomingRoomKeys) {
    const normalizedId = roomKey.groupId.trim();
    const existing = byGroupId.get(normalizedId);
    if (!existing || (roomKey.createdAt ?? 0) > (existing.createdAt ?? 0)) {
      byGroupId.set(normalizedId, roomKey);
    }
  }

  return Array.from(byGroupId.values()).sort((left, right) => left.groupId.localeCompare(right.groupId));
};

export const selectJoinedGroupIds = (
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
): ReadonlySet<string> => {
  const joinedGroupIds = new Set<string>();
  for (const entry of entries) {
    if (entry.status === "joined") {
      joinedGroupIds.add(entry.groupId.trim());
    }
  }
  return joinedGroupIds;
};

export const filterRoomKeySnapshotsToJoinedEvidence = (params: Readonly<{
  roomKeys: ReadonlyArray<RoomKeySnapshot>;
  explicitLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  chatState: EncryptedAccountBackupPayload["chatState"] | null | undefined;
}>): ReadonlyArray<RoomKeySnapshot> => {
  const normalizedRoomKeys = mergeRoomKeySnapshots(params.roomKeys, []);
  const joinedGroupIds = new Set<string>(selectJoinedGroupIds(params.explicitLedgerEntries));

  if (joinedGroupIds.size === 0 && params.chatState?.groupMessages) {
    for (const groupId of Object.keys(params.chatState.groupMessages)) {
      joinedGroupIds.add(groupId.trim());
    }
  }

  return normalizedRoomKeys.filter((roomKey) => joinedGroupIds.has(roomKey.groupId.trim()));
};

export const reconstructRoomKeySnapshotsFromChatState = (
  chatState: EncryptedAccountBackupPayload["chatState"] | null | undefined,
  options?: Readonly<{
    restrictToJoinedGroupIds?: ReadonlySet<string>;
  }>,
): ReadonlyArray<RoomKeySnapshot> => {
  const snapshots: RoomKeySnapshot[] = [];
  const groupMessages = chatState?.groupMessages ?? {};
  const restrictToJoinedGroupIds = options?.restrictToJoinedGroupIds;

  for (const [groupId, messages] of Object.entries(groupMessages)) {
    const normalizedGroupId = groupId.trim();
    if (restrictToJoinedGroupIds && !restrictToJoinedGroupIds.has(normalizedGroupId)) {
      continue;
    }

    for (const message of (messages ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roomKeyHex = (message as any).roomKeyHex?.trim();
      if (!roomKeyHex || roomKeyHex.length === 0) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createdAt = (message as any).timestamp ?? Date.now();
      snapshots.push({
        groupId: normalizedGroupId,
        roomKeyHex,
        createdAt,
      });
    }
  }

  return mergeRoomKeySnapshots(snapshots, []);
};

/**
 * Restore merge orchestration input types
 */
export type RestoreMergeOrchestrationInput = Readonly<{
  publicKeyHex: PublicKeyHex;
  sanitizedIncomingPayload: EncryptedAccountBackupPayload;
  currentPayload: EncryptedAccountBackupPayload | null;
  existingLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  existingRoomKeySnapshots: ReadonlyArray<RoomKeySnapshot>;
  freshDevice: boolean;
  shouldHydrateLocalMessages: boolean;
  canTrustIncomingPortableState: boolean;
  recoverySnapshot: EncryptedAccountBackupPayload | null;
  recoverySnapshotHasReplayableHistory: boolean;
  recoverySnapshotHasExplicitLedgerEvidence: boolean;
  recoverySnapshotHasExplicitRoomKeyEvidence: boolean;
  hasHydratedLocalReplayableHistory: boolean;
  hasExplicitLocalLedgerEvidence: boolean;
  hasExplicitLocalRoomKeyEvidence: boolean;
  hasExplicitLocalMessageDeleteEvidence: boolean;
}>;

/**
 * Restore merge orchestration result
 */
export type RestoreMergeOrchestrationResult = Readonly<{
  mergedPayload: EncryptedAccountBackupPayload;
  mergedMessageDeleteTombstones: ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>;
  mergedChatState: EncryptedAccountBackupPayload["chatState"];
  incomingLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  reconciledIncomingLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  reconstructedMergedLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  localExplicitLedgerEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  mergedCommunityMembershipLedger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  incomingRoomKeySnapshots: ReadonlyArray<RoomKeySnapshot>;
  localExplicitRoomKeySnapshots: ReadonlyArray<RoomKeySnapshot>;
  mergedExplicitRoomKeys: ReadonlyArray<RoomKeySnapshot>;
  reconstructedMergedRoomKeySnapshots: ReadonlyArray<RoomKeySnapshot>;
  mergedRoomKeys: ReadonlyArray<RoomKeySnapshot>;
  sanitizedIncomingPayloadWithoutCommunityState: EncryptedAccountBackupPayload;
}>;

/**
 * Orchestrates the restore merge process - extracted from mergeIncomingRestorePayload
 * to centralize merge-time event/log emission and result shaping behind the restore merge module.
 */
export const orchestrateRestoreMerge = (
  input: RestoreMergeOrchestrationInput,
): RestoreMergeOrchestrationResult => {
  const {
    sanitizedIncomingPayload,
    currentPayload,
    existingLedgerEntries,
    existingRoomKeySnapshots,
  } = input;

  // Extract community state from incoming payload
  const {
    communityMembershipLedger: _incomingCommunityMembershipLedger,
    roomKeys: _incomingRoomKeys,
    messageDeleteTombstones: _incomingMessageDeleteTombstones,
    ...sanitizedIncomingPayloadWithoutCommunityState
  } = sanitizedIncomingPayload;

  // Merge message delete tombstones
  const mergedMessageDeleteTombstones = mergeMessageDeleteTombstones(
    currentPayload?.messageDeleteTombstones,
    sanitizedIncomingPayload.messageDeleteTombstones,
  );

  // Build durable delete ID set for chat state sanitization
  const durableDeleteIds = toMessageDeleteTombstoneIdSet(mergedMessageDeleteTombstones);

  // Merge chat state
  const mergedChatState = currentPayload
    ? mergeChatState(currentPayload.chatState, sanitizedIncomingPayload.chatState, { durableDeleteIds })
    : sanitizePersistedChatStateMessagesByDeleteContract(sanitizedIncomingPayload.chatState, { durableDeleteIds });

  // Parse ledger entries
  const incomingLedgerEntries = parseCommunityMembershipLedgerSnapshot(sanitizedIncomingPayload.communityMembershipLedger);
  const currentLedgerEntries = parseCommunityMembershipLedgerSnapshot(currentPayload?.communityMembershipLedger);
  const localExplicitLedgerEntries = currentLedgerEntries.length > 0
    ? currentLedgerEntries
    : existingLedgerEntries;

  // Parse and filter room key snapshots
  const incomingRoomKeySnapshotsRaw = parseRoomKeySnapshots(sanitizedIncomingPayload.roomKeys);
  const currentRoomKeySnapshots = parseRoomKeySnapshots(currentPayload?.roomKeys);
  const localExplicitRoomKeySnapshotsRaw = currentRoomKeySnapshots.length > 0
    ? currentRoomKeySnapshots
    : existingRoomKeySnapshots;

  // Reconstruct ledger entries from chat state
  const reconstructedIncomingLedgerEntries = reconstructCommunityMembershipFromChatState(sanitizedIncomingPayload.chatState);
  const reconstructedMergedLedgerEntries = reconstructCommunityMembershipFromChatState(mergedChatState);

  // Reconcile incoming ledger with reconstructed evidence
  const reconciledIncomingLedgerEntries = reconcileIncomingLedgerWithReconstructedJoinedEvidence({
    incomingExplicitEntries: incomingLedgerEntries,
    reconstructedEntries: reconstructedIncomingLedgerEntries,
  });

  // Filter room keys to joined evidence
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

  // Merge explicit room keys
  const mergedExplicitRoomKeys = mergeRoomKeySnapshots(localExplicitRoomKeySnapshots, incomingRoomKeySnapshots);

  // Supplement and merge ledger entries
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

  // Select joined groups and reconstruct room keys
  const mergedJoinedGroupIds = selectJoinedGroupIds(mergedCommunityMembershipLedger);
  const reconstructedMergedRoomKeySnapshots = reconstructRoomKeySnapshotsFromChatState(mergedChatState, {
    restrictToJoinedGroupIds: mergedJoinedGroupIds,
  });

  // Final room key merge
  const mergedRoomKeys = mergeRoomKeySnapshots(mergedExplicitRoomKeys, reconstructedMergedRoomKeySnapshots);

  // Build merged payload result
  const mergedPayload: EncryptedAccountBackupPayload = currentPayload
    ? buildMergeWithCurrentPayload({
        sanitizedIncomingPayloadWithoutCommunityState,
        currentPayload,
        sanitizedIncomingPayload,
        mergedMessageDeleteTombstones,
        mergedChatState,
        mergedCommunityMembershipLedger,
        mergedRoomKeys,
      })
    : buildMergeWithoutCurrentPayload({
        sanitizedIncomingPayloadWithoutCommunityState,
        sanitizedIncomingPayload,
        mergedMessageDeleteTombstones,
        mergedChatState,
        mergedCommunityMembershipLedger,
        mergedRoomKeys,
      });

  return {
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
    sanitizedIncomingPayloadWithoutCommunityState,
  };
};

/**
 * Helper function to reconcile incoming ledger with reconstructed joined evidence
 */
const reconcileIncomingLedgerWithReconstructedJoinedEvidence = (params: Readonly<{
  incomingExplicitEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  reconstructedEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
}>): ReadonlyArray<CommunityMembershipLedgerEntry> => {
  const explicitByGroupId = new Map(params.incomingExplicitEntries.map(e => [e.groupId.trim(), e]));
  const result = [...params.incomingExplicitEntries];

  for (const reconstructed of params.reconstructedEntries) {
    const groupId = reconstructed.groupId.trim();
    const explicit = explicitByGroupId.get(groupId);

    if (!explicit) {
      // No explicit entry for this group - add reconstructed if joined
      if (reconstructed.status === "joined") {
        result.push(reconstructed);
      }
    } else if (explicit.status !== "joined" && reconstructed.status === "joined") {
      // Explicit entry exists but not joined - promote to joined if reconstructed shows joined
      const index = result.findIndex(e => e.groupId.trim() === groupId);
      if (index >= 0) {
        result[index] = { ...explicit, status: "joined" };
      }
    }
  }

  return result;
};

/**
 * Build merged payload when current payload exists (existing device merge)
 */
const buildMergeWithCurrentPayload = (params: Readonly<{
  sanitizedIncomingPayloadWithoutCommunityState: EncryptedAccountBackupPayload;
  currentPayload: EncryptedAccountBackupPayload;
  sanitizedIncomingPayload: EncryptedAccountBackupPayload;
  mergedMessageDeleteTombstones: ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>;
  mergedChatState: EncryptedAccountBackupPayload["chatState"];
  mergedCommunityMembershipLedger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  mergedRoomKeys: ReadonlyArray<RoomKeySnapshot>;
}>): EncryptedAccountBackupPayload => {
  const { currentPayload, sanitizedIncomingPayload, sanitizedIncomingPayloadWithoutCommunityState } = params;

  return {
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
    ...(params.mergedMessageDeleteTombstones.length > 0 ? { messageDeleteTombstones: params.mergedMessageDeleteTombstones } : {}),
    chatState: params.mergedChatState,
    privacySettings: {
      ...sanitizedIncomingPayload.privacySettings,
      ...currentPayload.privacySettings,
    },
    relayList: mergeRelayList(currentPayload.relayList, sanitizedIncomingPayload.relayList),
    uiSettings: mergeUiSettings(currentPayload.uiSettings, sanitizedIncomingPayload.uiSettings),
    ...(params.mergedCommunityMembershipLedger.length > 0
      ? { communityMembershipLedger: params.mergedCommunityMembershipLedger }
      : {}),
    ...(params.mergedRoomKeys.length > 0
      ? { roomKeys: params.mergedRoomKeys }
      : {}),
  };
};

/**
 * Build merged payload when no current payload (fresh device or incoming only)
 */
const buildMergeWithoutCurrentPayload = (params: Readonly<{
  sanitizedIncomingPayloadWithoutCommunityState: EncryptedAccountBackupPayload;
  sanitizedIncomingPayload: EncryptedAccountBackupPayload;
  mergedMessageDeleteTombstones: ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>;
  mergedChatState: EncryptedAccountBackupPayload["chatState"];
  mergedCommunityMembershipLedger: ReadonlyArray<CommunityMembershipLedgerEntry>;
  mergedRoomKeys: ReadonlyArray<RoomKeySnapshot>;
}>): EncryptedAccountBackupPayload => {
  const { sanitizedIncomingPayload, sanitizedIncomingPayloadWithoutCommunityState } = params;

  // Check if we have community state to include
  const hasCommunityState = params.mergedCommunityMembershipLedger.length > 0 || params.mergedRoomKeys.length > 0;

  if (hasCommunityState) {
    return {
      ...sanitizedIncomingPayloadWithoutCommunityState,
      ...(params.mergedMessageDeleteTombstones.length > 0 ? { messageDeleteTombstones: params.mergedMessageDeleteTombstones } : {}),
      chatState: params.mergedChatState,
      ...(params.mergedCommunityMembershipLedger.length > 0
        ? { communityMembershipLedger: params.mergedCommunityMembershipLedger }
        : {}),
      ...(params.mergedRoomKeys.length > 0
        ? { roomKeys: params.mergedRoomKeys }
        : {}),
    };
  }

  // No community state - return minimal merged payload
  return {
    ...sanitizedIncomingPayloadWithoutCommunityState,
    ...(params.mergedMessageDeleteTombstones.length > 0 ? { messageDeleteTombstones: params.mergedMessageDeleteTombstones } : {}),
    chatState: params.mergedChatState,
  };
};

/**
 * Merge helper functions for payload construction
 */
const mergeIdentityUnlock = (
  current: EncryptedAccountBackupPayload["identityUnlock"] | undefined,
  incoming: EncryptedAccountBackupPayload["identityUnlock"] | undefined,
): EncryptedAccountBackupPayload["identityUnlock"] | undefined => {
  if (!current && !incoming) return undefined;
  return {
    ...(current ?? {}),
    ...(incoming ?? {}),
  } as EncryptedAccountBackupPayload["identityUnlock"];
};

const mergePeerTrust = (
  current: EncryptedAccountBackupPayload["peerTrust"] | undefined,
  incoming: EncryptedAccountBackupPayload["peerTrust"] | undefined,
): EncryptedAccountBackupPayload["peerTrust"] => {
  const currentAccepted = current?.acceptedPeers ?? [];
  const incomingAccepted = incoming?.acceptedPeers ?? [];
  const currentMuted = current?.mutedPeers ?? [];
  const incomingMuted = incoming?.mutedPeers ?? [];

  return {
    acceptedPeers: Array.from(new Set([...currentAccepted, ...incomingAccepted])),
    mutedPeers: Array.from(new Set([...currentMuted, ...incomingMuted])),
  };
};

const mergeRequestFlowEvidence = (
  current: EncryptedAccountBackupPayload["requestFlowEvidence"] | undefined,
  incoming: EncryptedAccountBackupPayload["requestFlowEvidence"] | undefined,
): EncryptedAccountBackupPayload["requestFlowEvidence"] => {
  const currentByPeer = current?.byPeer ?? {};
  const incomingByPeer = incoming?.byPeer ?? {};

  return {
    byPeer: {
      ...currentByPeer,
      ...incomingByPeer,
    },
  };
};

const mergeOutbox = (
  current: EncryptedAccountBackupPayload["requestOutbox"] | undefined,
  incoming: EncryptedAccountBackupPayload["requestOutbox"] | undefined,
): EncryptedAccountBackupPayload["requestOutbox"] => {
  const currentRecords = current?.records ?? [];
  const incomingRecords = incoming?.records ?? [];

  // Merge by id with incoming taking precedence
  const byId = new Map(currentRecords.map(r => [r.id, r]));
  for (const record of incomingRecords) {
    byId.set(record.id, record);
  }

  return { records: Array.from(byId.values()) };
};

const mergeCheckpoints = (
  current: EncryptedAccountBackupPayload["syncCheckpoints"] | undefined,
  incoming: EncryptedAccountBackupPayload["syncCheckpoints"] | undefined,
): EncryptedAccountBackupPayload["syncCheckpoints"] => {
  const currentMap = new Map((current ?? []).map(c => [c.timelineKey, c]));
  const incomingMap = new Map((incoming ?? []).map(c => [c.timelineKey, c]));

  // Merge with incoming taking precedence (by updatedAtUnixMs)
  for (const [key, checkpoint] of incomingMap) {
    const existing = currentMap.get(key);
    if (!existing || (checkpoint.updatedAtUnixMs ?? 0) > (existing.updatedAtUnixMs ?? 0)) {
      currentMap.set(key, checkpoint);
    }
  }

  return Array.from(currentMap.values());
};

const mergeRelayList = (
  current: EncryptedAccountBackupPayload["relayList"] | undefined,
  incoming: EncryptedAccountBackupPayload["relayList"] | undefined,
): EncryptedAccountBackupPayload["relayList"] => {
  // RelayListSnapshot is an array, merge by url with incoming taking precedence
  const currentArray = current ?? [];
  const incomingArray = incoming ?? [];

  const byUrl = new Map(currentArray.map(r => [r.url, r]));
  for (const relay of incomingArray) {
    byUrl.set(relay.url, relay);
  }

  return Array.from(byUrl.values());
};

const DEFAULT_THEME_PREFERENCE = "system";
const DEFAULT_ACCESSIBILITY_PREFERENCES: NonNullable<EncryptedAccountBackupPayload["uiSettings"]>["accessibilityPreferences"] = {
  textScale: 100,
  reducedMotion: false,
  contrastAssist: false,
};

const isThemePreference = (value: unknown): value is "light" | "dark" | "system" =>
  typeof value === "string" && ["light", "dark", "system"].includes(value);

type AccessibilityPreferencesType = NonNullable<EncryptedAccountBackupPayload["uiSettings"]>["accessibilityPreferences"];

const parseAccessibilityPreferences = (value: unknown): AccessibilityPreferencesType => {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_ACCESSIBILITY_PREFERENCES;
  }
  const obj = value as Record<string, unknown>;
  const textScale = typeof obj.textScale === "number" && [90, 100, 110, 120].includes(obj.textScale)
    ? obj.textScale as 90 | 100 | 110 | 120
    : DEFAULT_ACCESSIBILITY_PREFERENCES.textScale;
  return {
    textScale,
    reducedMotion: typeof obj.reducedMotion === "boolean" ? obj.reducedMotion : DEFAULT_ACCESSIBILITY_PREFERENCES.reducedMotion,
    contrastAssist: typeof obj.contrastAssist === "boolean" ? obj.contrastAssist : DEFAULT_ACCESSIBILITY_PREFERENCES.contrastAssist,
  };
};

type UiSettingsType = NonNullable<EncryptedAccountBackupPayload["uiSettings"]>;
type LocalMediaStorageConfigType = UiSettingsType["localMediaStorageConfig"];

const mergeUiSettings = (
  current: EncryptedAccountBackupPayload["uiSettings"] | undefined,
  incoming: EncryptedAccountBackupPayload["uiSettings"] | undefined,
): EncryptedAccountBackupPayload["uiSettings"] | undefined => {
  // If neither has settings, return undefined
  if (!current && !incoming) return undefined;

  const currentConfig = current?.localMediaStorageConfig;
  const incomingConfig = incoming?.localMediaStorageConfig;

  const mergedConfig: LocalMediaStorageConfigType | undefined = currentConfig || incomingConfig
    ? {
        ...(currentConfig ?? {} as LocalMediaStorageConfigType),
        ...(incomingConfig ?? {} as LocalMediaStorageConfigType),
      } as LocalMediaStorageConfigType
    : undefined;

  const themePreference: UiSettingsType["themePreference"] = isThemePreference(incoming?.themePreference)
    ? incoming.themePreference
    : isThemePreference(current?.themePreference)
      ? current.themePreference
      : DEFAULT_THEME_PREFERENCE;

  const accessibilityPreferences: AccessibilityPreferencesType = {
    ...(current?.accessibilityPreferences ?? DEFAULT_ACCESSIBILITY_PREFERENCES),
    ...parseAccessibilityPreferences(incoming?.accessibilityPreferences),
  };

  const result: UiSettingsType = {
    themePreference,
    accessibilityPreferences,
    localMediaStorageConfig: mergedConfig ?? currentConfig ?? incomingConfig ?? {} as LocalMediaStorageConfigType,
  };

  return result;
};
