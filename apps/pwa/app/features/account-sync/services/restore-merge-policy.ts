import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { EncryptedAccountBackupPayload, RoomKeySnapshot } from "../account-sync-contracts";
import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";
import {
  emitPublishConvergenceFloorApplied,
  emitPublishConvergenceFloorSkipped,
  hasSparseDmOutgoingEvidenceForConvergenceFloor,
  isLowEvidenceBackupPayloadForPublish,
  summarizeBackupPayloadConvergenceDiagnostics,
  type BackupPayloadConvergenceDiagnostics,
} from "./restore-merge-diagnostics";
import type { ChatStateMessageDiagnostics } from "./restore-diagnostics";
import { parseRoomKeySnapshots } from "./restore-merge-diagnostics";
import { selectJoinedCommunityMembershipLedgerEntries } from "@/app/features/groups/services/community-membership-ledger";

const hasAcceptedRequestFlowEvidence = (snapshot: { byPeer: Record<string, { acceptSeen: boolean }> }): boolean => (
  Object.values(snapshot.byPeer).some((evidence) => evidence.acceptSeen)
);

const hasAcceptedConnectionRequest = (value: EncryptedAccountBackupPayload["chatState"]): boolean => (
  Boolean(value?.connectionRequests?.some((request) => request.status === "accepted"))
);

export const hasPortablePrivateStateEvidence = (
  payload: EncryptedAccountBackupPayload,
  hasReplayableChatHistory: (chatState: EncryptedAccountBackupPayload["chatState"]) => boolean,
): boolean => {
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

export const mergeBackupPayloadForPublishConvergence = (params: Readonly<{
  localPayload: EncryptedAccountBackupPayload;
  remotePayload: EncryptedAccountBackupPayload;
  mergeMessageDeleteTombstones: (
    left: EncryptedAccountBackupPayload["messageDeleteTombstones"],
    right: EncryptedAccountBackupPayload["messageDeleteTombstones"],
  ) => ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>;
  toMessageDeleteTombstoneIdSet: (
    entries: ReadonlyArray<Readonly<{ id: string; deletedAtUnixMs: number }>>,
  ) => ReadonlySet<string>;
  mergeChatState: (
    current: EncryptedAccountBackupPayload["chatState"],
    incoming: EncryptedAccountBackupPayload["chatState"],
    options?: Readonly<{ durableDeleteIds?: ReadonlySet<string> }>,
  ) => EncryptedAccountBackupPayload["chatState"];
  parseCommunityMembershipLedgerSnapshot: (
    entries: EncryptedAccountBackupPayload["communityMembershipLedger"],
  ) => ReadonlyArray<CommunityMembershipLedgerEntry>;
  reconstructCommunityMembershipFromChatState: (
    chatState: EncryptedAccountBackupPayload["chatState"],
  ) => ReadonlyArray<CommunityMembershipLedgerEntry>;
  reconcileIncomingLedgerWithReconstructedJoinedEvidence: (params: Readonly<{
    incomingExplicitEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
    reconstructedEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  }>) => ReadonlyArray<CommunityMembershipLedgerEntry>;
  mergeCommunityMembershipLedgerEntries: (
    left: ReadonlyArray<CommunityMembershipLedgerEntry>,
    right: ReadonlyArray<CommunityMembershipLedgerEntry>,
  ) => ReadonlyArray<CommunityMembershipLedgerEntry>;
  supplementMembershipLedgerEntries: (params: Readonly<{
    explicitEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
    supplementalEntries: ReadonlyArray<CommunityMembershipLedgerEntry>;
  }>) => ReadonlyArray<CommunityMembershipLedgerEntry>;
  parseRoomKeySnapshots: (
    entries: EncryptedAccountBackupPayload["roomKeys"],
  ) => ReadonlyArray<RoomKeySnapshot>;
  mergeRoomKeySnapshots: (
    left: ReadonlyArray<RoomKeySnapshot>,
    right: ReadonlyArray<RoomKeySnapshot>,
  ) => ReadonlyArray<RoomKeySnapshot>;
  selectJoinedGroupIds: (
    entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
  ) => ReadonlySet<string>;
  reconstructRoomKeySnapshotsFromChatState: (
    chatState: EncryptedAccountBackupPayload["chatState"],
    options?: Readonly<{ restrictToJoinedGroupIds?: ReadonlySet<string> }>,
  ) => ReadonlyArray<RoomKeySnapshot>;
  mergeIdentityUnlock: (
    current: EncryptedAccountBackupPayload["identityUnlock"],
    incoming: EncryptedAccountBackupPayload["identityUnlock"],
  ) => EncryptedAccountBackupPayload["identityUnlock"];
  mergePeerTrust: (
    current: EncryptedAccountBackupPayload["peerTrust"],
    incoming: EncryptedAccountBackupPayload["peerTrust"],
  ) => EncryptedAccountBackupPayload["peerTrust"];
  mergeRequestFlowEvidence: (
    current: EncryptedAccountBackupPayload["requestFlowEvidence"],
    incoming: EncryptedAccountBackupPayload["requestFlowEvidence"],
  ) => EncryptedAccountBackupPayload["requestFlowEvidence"];
  mergeOutbox: (
    current: EncryptedAccountBackupPayload["requestOutbox"],
    incoming: EncryptedAccountBackupPayload["requestOutbox"],
  ) => EncryptedAccountBackupPayload["requestOutbox"];
  mergeCheckpoints: (
    current: EncryptedAccountBackupPayload["syncCheckpoints"],
    incoming: EncryptedAccountBackupPayload["syncCheckpoints"],
  ) => EncryptedAccountBackupPayload["syncCheckpoints"];
  mergeRelayList: (
    current: EncryptedAccountBackupPayload["relayList"],
    incoming: EncryptedAccountBackupPayload["relayList"],
  ) => EncryptedAccountBackupPayload["relayList"];
}>): EncryptedAccountBackupPayload => {
  const mergedMessageDeleteTombstones = params.mergeMessageDeleteTombstones(
    params.localPayload.messageDeleteTombstones,
    params.remotePayload.messageDeleteTombstones,
  );
  const mergedChatState = params.mergeChatState(
    params.localPayload.chatState,
    params.remotePayload.chatState,
    {
      durableDeleteIds: params.toMessageDeleteTombstoneIdSet(mergedMessageDeleteTombstones),
    },
  );
  const remoteLedgerEntries = params.parseCommunityMembershipLedgerSnapshot(
    params.remotePayload.communityMembershipLedger,
  );
  const localLedgerEntries = params.parseCommunityMembershipLedgerSnapshot(
    params.localPayload.communityMembershipLedger,
  );
  const reconstructedRemoteLedgerEntries = params.reconstructCommunityMembershipFromChatState(
    params.remotePayload.chatState,
  );
  const reconciledRemoteLedgerEntries = params.reconcileIncomingLedgerWithReconstructedJoinedEvidence({
    incomingExplicitEntries: remoteLedgerEntries,
    reconstructedEntries: reconstructedRemoteLedgerEntries,
  });
  const mergedExplicitLedgerEntries = params.mergeCommunityMembershipLedgerEntries(
    localLedgerEntries,
    reconciledRemoteLedgerEntries,
  );
  const mergedSupplementedLedgerEntries = params.supplementMembershipLedgerEntries({
    explicitEntries: mergedExplicitLedgerEntries,
    supplementalEntries: params.reconstructCommunityMembershipFromChatState(mergedChatState),
  });
  const mergedCommunityMembershipLedger = params.mergeCommunityMembershipLedgerEntries(
    mergedExplicitLedgerEntries,
    mergedSupplementedLedgerEntries,
  );
  const mergedExplicitRoomKeys = params.mergeRoomKeySnapshots(
    params.parseRoomKeySnapshots(params.localPayload.roomKeys),
    params.parseRoomKeySnapshots(params.remotePayload.roomKeys),
  );
  const mergedJoinedGroupIds = params.selectJoinedGroupIds(mergedCommunityMembershipLedger);
  const reconstructedMergedRoomKeys = params.reconstructRoomKeySnapshotsFromChatState(
    mergedChatState,
    { restrictToJoinedGroupIds: mergedJoinedGroupIds },
  );
  const mergedRoomKeys = params.mergeRoomKeySnapshots(
    mergedExplicitRoomKeys,
    reconstructedMergedRoomKeys,
  );

  return {
    ...params.localPayload,
    identityUnlock: params.mergeIdentityUnlock(
      params.localPayload.identityUnlock,
      params.remotePayload.identityUnlock,
    ),
    peerTrust: params.mergePeerTrust(
      params.localPayload.peerTrust,
      params.remotePayload.peerTrust,
    ),
    requestFlowEvidence: params.mergeRequestFlowEvidence(
      params.localPayload.requestFlowEvidence,
      params.remotePayload.requestFlowEvidence,
    ),
    requestOutbox: params.mergeOutbox(
      params.localPayload.requestOutbox,
      params.remotePayload.requestOutbox,
    ),
    syncCheckpoints: params.mergeCheckpoints(
      params.localPayload.syncCheckpoints,
      params.remotePayload.syncCheckpoints,
    ),
    ...(mergedMessageDeleteTombstones.length > 0 ? { messageDeleteTombstones: mergedMessageDeleteTombstones } : {}),
    chatState: mergedChatState,
    relayList: params.mergeRelayList(
      params.localPayload.relayList,
      params.remotePayload.relayList,
    ),
    ...(mergedCommunityMembershipLedger.length > 0
      ? { communityMembershipLedger: mergedCommunityMembershipLedger }
      : {}),
    ...(mergedRoomKeys.length > 0
      ? { roomKeys: mergedRoomKeys }
      : {}),
  };
};

export type BackupPublishConvergenceFetchStatus =
  | "not_required"
  | "pool_unavailable"
  | "no_backup"
  | "degraded_backup"
  | "fetched"
  | "error";

export type BackupPublishConvergenceResult = Readonly<{
  payload: EncryptedAccountBackupPayload;
  localDiagnostics: BackupPayloadConvergenceDiagnostics;
  remoteDiagnostics?: BackupPayloadConvergenceDiagnostics;
  floorRequired: boolean;
  localLowEvidence: boolean;
  remoteHasBackup: boolean;
  fetchStatus: BackupPublishConvergenceFetchStatus;
}>;

export type BackupPublishSuppressionReason =
  | "low_evidence_convergence_unverified"
  | "empty_private_state";

export type BackupPublishSuppressionResult = Readonly<{
  suppressed: true;
  reason: BackupPublishSuppressionReason;
  message: string;
  convergedResult: BackupPublishConvergenceResult;
}>;

export const shouldSuppressBackupPublish = (
  convergedResult: BackupPublishConvergenceResult,
): boolean => {
  if (!convergedResult.localLowEvidence) {
    return false;
  }
  const unverifiedFetchStatus = (
    convergedResult.fetchStatus === "no_backup"
    || convergedResult.fetchStatus === "degraded_backup"
    || convergedResult.fetchStatus === "error"
  );
  return unverifiedFetchStatus;
};

export const buildSuppressedPublishResult = (params: Readonly<{
  convergedResult: BackupPublishConvergenceResult;
  reason: BackupPublishSuppressionReason;
  message: string;
}>): BackupPublishSuppressionResult => ({
  suppressed: true,
  reason: params.reason,
  message: params.message,
  convergedResult: params.convergedResult,
});

export type FetchLatestBackupPayload = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
}>) => Promise<Readonly<{
  hasBackup: boolean;
  payload: EncryptedAccountBackupPayload | null;
  degradedReason?: string;
}>>;

export const maybeConvergeBackupPayloadBeforePublish = async (params: Readonly<{
  localPayload: EncryptedAccountBackupPayload;
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  poolAvailable: boolean;
  summarizeChatStateDiagnostics: (
    chatState: EncryptedAccountBackupPayload["chatState"],
    publicKeyHex: PublicKeyHex,
  ) => ChatStateMessageDiagnostics;
  hasReplayableChatHistory: (chatState: EncryptedAccountBackupPayload["chatState"]) => boolean;
  fetchLatestPayload: FetchLatestBackupPayload;
  mergeForConvergence: (params: Readonly<{
    localPayload: EncryptedAccountBackupPayload;
    remotePayload: EncryptedAccountBackupPayload;
  }>) => EncryptedAccountBackupPayload;
}>): Promise<BackupPublishConvergenceResult> => {
  const localDiagnostics = summarizeBackupPayloadConvergenceDiagnostics({
    payload: params.localPayload,
    publicKeyHex: params.publicKeyHex,
    summarizeChatStateDiagnostics: params.summarizeChatStateDiagnostics,
  });
  const applyGroupEvidenceFloor = localDiagnostics.groupEvidenceCount === 0;
  const applySparseDmOutgoingFloor = hasSparseDmOutgoingEvidenceForConvergenceFloor(localDiagnostics);
  const floorRequired = applyGroupEvidenceFloor || applySparseDmOutgoingFloor;
  const localLowEvidence = isLowEvidenceBackupPayloadForPublish({
    payload: params.localPayload,
    diagnostics: localDiagnostics,
    hasReplayableChatHistory: params.hasReplayableChatHistory,
  });
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
  if (!params.poolAvailable) {
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
    const fetched = await params.fetchLatestPayload({
      publicKeyHex: params.publicKeyHex,
      privateKeyHex: params.privateKeyHex,
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

    const remoteDiagnostics = summarizeBackupPayloadConvergenceDiagnostics({
      payload: fetched.payload,
      publicKeyHex: params.publicKeyHex,
      summarizeChatStateDiagnostics: params.summarizeChatStateDiagnostics,
    });
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

    const convergedPayload = params.mergeForConvergence({
      localPayload: params.localPayload,
      remotePayload: fetched.payload,
    });
    const convergedDiagnostics = summarizeBackupPayloadConvergenceDiagnostics({
      payload: convergedPayload,
      publicKeyHex: params.publicKeyHex,
      summarizeChatStateDiagnostics: params.summarizeChatStateDiagnostics,
    });
    emitPublishConvergenceFloorApplied({
      publicKeyHex: params.publicKeyHex,
      applyGroupEvidenceFloor,
      applySparseDmOutgoingFloor,
      localDiagnostics,
      remoteDiagnostics,
      convergedDiagnostics,
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
    emitPublishConvergenceFloorSkipped({
      publicKeyHex: params.publicKeyHex,
      reason: error instanceof Error ? error.message : String(error),
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

export type BackupEnvelope = Readonly<{
  ciphertext: string;
}>;

export type BackupCreatedAtReservation = Readonly<{
  createdAtUnixSeconds: number;
  candidateUnixSeconds: number;
  lastUsedUnixSeconds?: number;
  monotonicBumpApplied: boolean;
}>;

export type BackupPublishOrchestrationResult = Readonly<{
  publishResult: {
    status: "ok" | "partial" | "queued" | "failed";
    message?: string;
    value?: { successCount: number; totalRelays: number };
  };
  envelope: BackupEnvelope;
  backupPayload: EncryptedAccountBackupPayload;
  signedEvent: { id: string; sig: string; [key: string]: unknown };
}>;

export const buildBackupEnvelope = async (params: Readonly<{
  backupPayload: EncryptedAccountBackupPayload;
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  encryptDM: (plaintext: string, publicKeyHex: PublicKeyHex, privateKeyHex: PrivateKeyHex) => Promise<string>;
}>): Promise<BackupEnvelope> => {
  const plaintext = JSON.stringify(params.backupPayload);
  const ciphertext = await params.encryptDM(plaintext, params.publicKeyHex, params.privateKeyHex);
  return { ciphertext };
};

export const buildBackupUnsignedEvent = (params: Readonly<{
  envelope: BackupEnvelope;
  publicKeyHex: PublicKeyHex;
  backupPayload: EncryptedAccountBackupPayload;
  reserveCreatedAt: (publicKeyHex: PublicKeyHex, createdAtUnixMs: number) => BackupCreatedAtReservation;
  accountBackupEventKind: number;
  accountBackupDTag: string;
  accountBackupCreatedAtMsTag: string;
}>): Readonly<{
  unsignedEvent: { kind: number; pubkey: string; created_at: number; tags: string[][]; content: string };
  createdAtReservation: BackupCreatedAtReservation;
}> => {
  const createdAtReservation = params.reserveCreatedAt(
    params.publicKeyHex,
    params.backupPayload.createdAtUnixMs,
  );
  const unsignedEvent = {
    kind: params.accountBackupEventKind,
    pubkey: params.publicKeyHex,
    created_at: createdAtReservation.createdAtUnixSeconds,
    tags: [
      ["d", params.accountBackupDTag],
      [params.accountBackupCreatedAtMsTag, String(params.backupPayload.createdAtUnixMs)],
    ],
    content: params.envelope.ciphertext,
  };
  return { unsignedEvent, createdAtReservation };
};

export type RelayPublishResult = Readonly<{
  status: "ok" | "partial" | "queued" | "failed" | "unsupported";
  message?: string;
  value?: { successCount: number; totalRelays: number };
}>;

export const mapBackupDeliveryStatus = (publishResult: RelayPublishResult): (
  "sent_quorum" | "sent_partial" | "queued" | "failed"
) => {
  switch (publishResult.status) {
    case "ok":
      return "sent_quorum";
    case "partial":
      return "sent_partial";
    case "queued":
      return "queued";
    case "failed":
    case "unsupported":
      return "failed";
    default:
      return "failed";
  }
};

export const isBackupPublishSuccessful = (status: RelayPublishResult["status"]): boolean => (
  status === "ok" || status === "partial" || status === "queued"
);

export type BackupPublishSnapshotParams = Readonly<{
  publicKeyHex: PublicKeyHex;
  eventId: string;
  deliveryStatus: "sent_quorum" | "sent_partial" | "queued" | "failed";
  successCount?: number;
  totalRelays?: number;
  message?: string;
}>;

export type BackupPublishSnapshotUpdate = Readonly<{
  publicKeyHex: PublicKeyHex;
  lastEncryptedBackupPublishAtUnixMs: number;
  hasEncryptedBackup: boolean;
  lastRelayFailureReason?: string;
}>;
