import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupAccessMode, CommunityMode, RelayCapabilityTier } from "@/app/features/groups/types";
import type { GroupConversation } from "@/app/features/messaging/types";
import { GroupService } from "@/app/features/groups/services/group-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import { resolveInitialStewardPubkeysForCreate } from "@/app/features/groups/services/community-steward-policy";
import { assessWorkspaceCommunityTrustAsync } from "@/app/features/groups/services/community-trust-policy";
import { hasWritableCommunityRelayTransport } from "@/app/features/groups/services/community-relay-transport";
import { isRelayAuthoritativeMembershipEnforced } from "@/app/features/groups/services/community-relay-authoritative-membership-policy";
import { isCoordinationOnlyWorkspaceDevMode } from "@/app/features/groups/services/community-dev-flags";
import { LOCAL_DEV_RELAY_URL } from "@/app/features/relays/hooks/use-relay-list";
import { ensureWorkspaceRelayTransportReady } from "@/app/features/groups/services/workspace-relay-calibrator";
import {
  createWorkspaceActivationPublisher,
  prepareWorkspaceActivationTransport,
  publishWorkspaceCoordinationJoinEvidence,
  runWorkspaceMembershipActivation,
  summarizeWorkspaceActivation,
  type WorkspaceActivationRelayEvidence,
  type WorkspaceMembershipActivationResult,
  type WorkspaceRelayPublishPool,
} from "@/app/features/groups/services/community-workspace-activation";
import type { WorkspaceRelayPoolTransport } from "@/app/features/groups/services/workspace-relay-calibrator";
import { ensureWorkspaceMembershipSyncMode } from "@/app/features/groups/services/community-workspace-membership";
import { deriveCommunityId } from "@/app/features/groups/utils/community-identity";
import { toGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import {
  loadCoordinationMembershipDirectory,
  refreshCoordinationMembershipDirectory,
} from "@/app/features/groups/services/community-coordination-membership-directory-store";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { publishCoordinationMembershipDelta } from "@/app/features/groups/services/community-coordination-membership-client";
import { publishSelfCoordinationRoomKeyWrapAfterJoin } from "@/app/features/groups/services/community-coordination-room-key-owner";
import { isCoordinationConfigured } from "@/app/features/groups/services/community-membership-sync-mode";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  toCommunityMembershipLedgerEntryFromGroup,
} from "@/app/features/groups/services/community-membership-ledger";
import { persistCommunityMembershipLedgerMutation } from "@/app/features/groups/services/community-membership-mutation-owner";
import {
  resolveCommunityMembershipHealth,
  type CommunityMembershipHealth,
} from "@/app/features/groups/services/community-membership-health";
import {
  isManagedWorkspaceJoinSuccessful,
  rollbackJoinRoomKeyAttempt,
} from "@/app/features/groups/services/community-membership-join-transaction";
import { isPubkeyActiveInManagedWorkspace } from "./workspace-kernel-list-port";
import { logWorkspaceKernelDiagnostic } from "./workspace-kernel-diagnostics";
import { upsertWorkspaceGroupMetadata } from "./workspace-kernel-group-metadata-cache";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type WorkspaceKernelMembershipPortStatus = "w1_landed";

export const workspaceKernelMembershipPortStatus = (): WorkspaceKernelMembershipPortStatus => "w1_landed";

export type ManagedWorkspaceCreateInput = Readonly<{
  host: string;
  groupId: string;
  name: string;
  about: string;
  avatar?: string;
  access: GroupAccessMode;
  relayCapabilityTier: RelayCapabilityTier;
  communityMode: CommunityMode;
}>;

export type CreateManagedWorkspaceMembershipParams = Readonly<{
  info: ManagedWorkspaceCreateInput;
  myPublicKeyHex: PublicKeyHex;
  myPrivateKeyHex: PrivateKeyHex;
  relayPool: WorkspaceRelayPublishPool & WorkspaceRelayPoolTransport;
  openRelayUrls: ReadonlyArray<string>;
  addRelay: (relayParams: Readonly<{ url: string }>) => void;
  onPhase?: (phase: "local" | "relay" | "directory" | "done") => void;
}>;

export type CreateManagedWorkspaceMembershipResult = Readonly<{
  ok: true;
  group: GroupConversation;
  activationSummary: ReturnType<typeof summarizeWorkspaceActivation>;
}> | Readonly<{
  ok: false;
  errorMessage: string;
  userFacingMessage?: string;
}>;

export type JoinManagedWorkspaceMembershipParams = Readonly<{
  communityId: string;
  groupId: string;
  relayUrl: string;
  displayName?: string;
  memberPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
  pool: WorkspaceRelayPublishPool & WorkspaceRelayPoolTransport;
  addRelay: (relayParams: Readonly<{ url: string }>) => void;
  openRelayUrls?: ReadonlyArray<string>;
  /** Invite redemption must pass the room key before activation (R1 atomic join). */
  roomKeyHex?: string;
  nip29JoinJson?: string;
  sealedJoinJson?: string;
}>;

export type JoinManagedWorkspaceMembershipResult = Readonly<{
  ok: true;
  group: GroupConversation;
  activation: WorkspaceMembershipActivationResult;
  health: CommunityMembershipHealth;
}> | Readonly<{
  ok: false;
  errorMessage: string;
  userFacingMessage?: string;
  activation: WorkspaceMembershipActivationResult;
  health: CommunityMembershipHealth;
}>;

/** W1 membership-port is ready when kernel authority is on and coordination is configured. */
export const isWorkspaceKernelMembershipPortReady = (): boolean => (
  isWorkspaceKernelAuthority() && isCoordinationConfigured()
);

export const readManagedWorkspaceMembership = (
  communityId: string,
  profileId?: string,
): CoordinationMembershipMaterialization | null => (
  loadCoordinationMembershipDirectory(communityId, profileId)
);

export const refreshManagedWorkspaceMembership = async (params: Readonly<{
  communityId: string;
  profileId?: string;
  forceFull?: boolean;
}>): Promise<CoordinationMembershipMaterialization | null> => {
  logWorkspaceKernelDiagnostic("workspace.membership.load", { communityId: params.communityId });
  return refreshCoordinationMembershipDirectory(params);
};

export const publishManagedWorkspaceMembershipLeave = async (params: Readonly<{
  communityId: string;
  subjectPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
}>): Promise<Readonly<{ success: boolean; errorMessage?: string }>> => {
  ensureWorkspaceMembershipSyncMode();
  const result = await publishCoordinationMembershipDelta({
    communityId: params.communityId,
    action: "leave",
    subjectPubkey: params.subjectPubkey,
    actorPubkey: params.actorPubkey,
    actorPrivateKeyHex: params.actorPrivateKeyHex,
  });
  if (!result.success) {
    logWorkspaceKernelDiagnostic("workspace.leave.rejected", {
      communityId: params.communityId,
      error: result.errorMessage ?? "coordination_leave_failed",
    });
  }
  return { success: result.success, errorMessage: result.errorMessage };
};

export const createManagedWorkspaceMembership = async (
  params: CreateManagedWorkspaceMembershipParams,
): Promise<CreateManagedWorkspaceMembershipResult> => {
  if (!isWorkspaceKernelMembershipPortReady()) {
    return { ok: false, errorMessage: "workspace_kernel_membership_port_not_ready" };
  }

  const { info, myPublicKeyHex, myPrivateKeyHex, relayPool, openRelayUrls, addRelay, onPhase } = params;
  ensureWorkspaceMembershipSyncMode();
  onPhase?.("local");

  const rawRelayInput = (() => {
    const trimmedHost = info.host.trim();
    if (!trimmedHost && isCoordinationOnlyWorkspaceDevMode()) {
      return LOCAL_DEV_RELAY_URL;
    }
    return trimmedHost;
  })();

  const calibration = await ensureWorkspaceRelayTransportReady({
    rawUrl: rawRelayInput,
    pool: relayPool,
    timeoutMs: 5000,
  });
  const relayUrl = calibration.canonicalUrl;
  const communityMode = "managed_workspace" as const;

  const trust = await assessWorkspaceCommunityTrustAsync({
    communityRelayUrl: relayUrl,
    enabledRelayUrls: openRelayUrls,
  });
  if (!trust.allowed) {
    return { ok: false, errorMessage: "workspace_trust_blocked", userFacingMessage: trust.userMessage };
  }

  const relayTransportReady = hasWritableCommunityRelayTransport(relayUrl);
  if (relayTransportReady) {
    addRelay({ url: relayUrl });
    if (typeof relayPool.addTransientRelay === "function") {
      relayPool.addTransientRelay(relayUrl);
    }
  }

  logAppEvent({
    name: "workspace_kernel.membership.create_started",
    level: "info",
    scope: { feature: "workspace-kernel", action: "membership_create" },
    context: {
      groupId: info.groupId,
      relayUrl,
      communityMode,
    },
  });

  const roomKeyHex = await cryptoService.generateRoomKey();
  await roomKeyStore.saveRoomKey(info.groupId, roomKeyHex);
  onPhase?.("relay");

  const stewardPubkeys = resolveInitialStewardPubkeysForCreate({
    communityMode,
    creatorPublicKeyHex: myPublicKeyHex,
  });
  const metadata = {
    id: info.groupId,
    name: info.name,
    about: info.about,
    picture: info.avatar,
    access: info.access,
    communityMode,
    relayCapabilityTier: info.relayCapabilityTier,
    ...(stewardPubkeys.length > 0 ? { stewardPubkeys } : {}),
  } as const;

  const groupService = new GroupService(myPublicKeyHex, myPrivateKeyHex);
  const createdEvent = await groupService.sendSealedCommunityCreated({
    groupId: info.groupId,
    roomKeyHex,
    metadata,
  });

  let relayEvidence: WorkspaceActivationRelayEvidence = {
    status: relayTransportReady ? "failed" : "skipped",
    canonicalUrl: relayUrl,
    publishTargets: [],
    lastError: relayTransportReady ? "genesis_not_published" : undefined,
  };

  if (relayTransportReady) {
    const transport = await prepareWorkspaceActivationTransport({
      rawRelayUrl: relayUrl,
      pool: relayPool,
      addRelay,
      openRelayUrls,
      timeoutMs: 8000,
    });
    const publish = createWorkspaceActivationPublisher(relayPool, transport.publishTargets);
    const genesisResult = await publish(JSON.stringify(["EVENT", createdEvent]));
    relayEvidence = {
      status: genesisResult.success ? "synced" : "failed",
      canonicalUrl: transport.canonicalUrl || relayUrl,
      publishTargets: transport.publishTargets,
      lastError: genesisResult.success ? undefined : (genesisResult.error ?? "genesis_publish_failed"),
    };
  }

  const genesisEventId = createdEvent.id;
  const resolvedRelayUrl = relayEvidence.canonicalUrl || relayUrl;
  const communityId = deriveCommunityId({
    groupId: info.groupId,
    relayUrl: resolvedRelayUrl,
    genesisEventId,
    creatorPubkey: myPublicKeyHex,
  });

  onPhase?.("directory");

  const coordination = await publishWorkspaceCoordinationJoinEvidence({
    communityId,
    memberPubkey: myPublicKeyHex,
    actorPubkey: myPublicKeyHex,
    actorPrivateKeyHex: myPrivateKeyHex,
  });

  const activationSummary = summarizeWorkspaceActivation({
    relay: relayEvidence,
    coordination,
    context: "create",
    displayName: info.name,
  });

  const coordinationCreateConfirmed = coordination.status === "synced";
  if (
    isRelayAuthoritativeMembershipEnforced()
    && relayEvidence.status !== "synced"
    && !coordinationCreateConfirmed
  ) {
    return {
      ok: false,
      errorMessage: "relay_genesis_not_confirmed",
      userFacingMessage: "Relay did not confirm community creation. Nothing was saved locally.",
    };
  }
  if (activationSummary.severity !== "success" && !coordinationCreateConfirmed) {
    return {
      ok: false,
      errorMessage: "activation_incomplete",
      userFacingMessage: activationSummary.detail
        ? `${activationSummary.title} ${activationSummary.detail}`
        : activationSummary.title,
    };
  }

  const newGroup: GroupConversation = {
    kind: "group",
    id: toGroupConversationId({ groupId: info.groupId, relayUrl: resolvedRelayUrl, communityId }),
    communityId,
    genesisEventId,
    creatorPubkey: myPublicKeyHex,
    groupId: info.groupId,
    relayUrl: resolvedRelayUrl,
    displayName: info.name,
    memberPubkeys: [myPublicKeyHex],
    lastMessage: "Sealed community created locally",
    unreadCount: 0,
    lastMessageTime: new Date(),
    access: info.access,
    memberCount: 1,
    adminPubkeys: [myPublicKeyHex],
    avatar: info.avatar,
    communityMode,
    relayCapabilityTier: info.relayCapabilityTier,
  };

  const profileId = getResolvedProfileId();
  await refreshCoordinationMembershipDirectory({
    communityId,
    forceFull: true,
    profileId,
    roomKeyMaterialization: {
      localPubkey: myPublicKeyHex,
      localPrivateKeyHex: myPrivateKeyHex,
      groupId: info.groupId,
    },
  });
  if (coordinationCreateConfirmed) {
    await publishSelfCoordinationRoomKeyWrapAfterJoin({
      communityId,
      groupId: info.groupId,
      memberPubkey: myPublicKeyHex,
      actorPubkey: myPublicKeyHex,
      actorPrivateKeyHex: myPrivateKeyHex,
      roomKeyHex,
    });
  }
  persistCommunityMembershipLedgerMutation(
    myPublicKeyHex,
    {
      reason: "runtime_join_confirmed",
      entry: toCommunityMembershipLedgerEntryFromGroup(newGroup, { status: "joined" }),
    },
    { profileId },
  );
  upsertWorkspaceGroupMetadata(myPublicKeyHex, profileId, newGroup);
  onPhase?.("done");

  return { ok: true, group: newGroup, activationSummary };
};

const buildJoinFailureResult = (params: Readonly<{
  activation: WorkspaceMembershipActivationResult;
  health: CommunityMembershipHealth;
  errorMessage: string;
  userFacingMessage?: string;
}>): JoinManagedWorkspaceMembershipResult => ({
  ok: false,
  errorMessage: params.errorMessage,
  userFacingMessage: params.userFacingMessage,
  activation: params.activation,
  health: params.health,
});

const buildJoinHealthSnapshot = (params: Readonly<{
  communityId: string;
  memberPubkey: PublicKeyHex;
  relayUrl: string;
  activation: WorkspaceMembershipActivationResult;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  roomKeyPresent: boolean;
}>): CommunityMembershipHealth => (
  resolveCommunityMembershipHealth({
    communityId: params.communityId,
    localMemberPubkey: params.memberPubkey,
    coordinationDirectory: params.coordinationDirectory,
    roomKeyPresent: params.roomKeyPresent,
    relayTransportReady: hasWritableCommunityRelayTransport(
      params.activation.relay.canonicalUrl || params.relayUrl,
    ),
    relayActivationSynced: params.activation.relay.status === "synced",
    activationPending: params.activation.summary.severity === "partial",
    devCoordinationOnly: isCoordinationOnlyWorkspaceDevMode(),
  })
);

export const joinManagedWorkspaceMembership = async (
  params: JoinManagedWorkspaceMembershipParams,
): Promise<JoinManagedWorkspaceMembershipResult> => {
  const failedActivation = (
    errorMessage: string,
    userFacingMessage: string,
    lastError?: string,
  ): JoinManagedWorkspaceMembershipResult => {
    const activation: WorkspaceMembershipActivationResult = {
      relay: {
        status: "failed",
        canonicalUrl: params.relayUrl,
        publishTargets: [],
        lastError: lastError ?? errorMessage,
      },
      coordination: { status: "failed", lastError: errorMessage },
      summary: {
        severity: "failed",
        title: "Join failed",
        detail: userFacingMessage,
        recovery: ["start_coordination"],
      },
    };
    return buildJoinFailureResult({
      activation,
      health: buildJoinHealthSnapshot({
        communityId: params.communityId,
        memberPubkey: params.memberPubkey,
        relayUrl: params.relayUrl,
        activation,
        coordinationDirectory: null,
        roomKeyPresent: false,
      }),
      errorMessage,
      userFacingMessage,
    });
  };

  if (!isWorkspaceKernelMembershipPortReady()) {
    return failedActivation(
      "workspace_kernel_membership_port_not_ready",
      "Workspace kernel membership port is not ready.",
    );
  }

  ensureWorkspaceMembershipSyncMode();
  const profileId = getResolvedProfileId();
  const priorRoomKeyHex = (await roomKeyStore.getRoomKey(params.groupId))?.trim() || null;
  let roomKeySavedThisAttempt = false;

  if (params.roomKeyHex?.trim()) {
    await roomKeyStore.saveRoomKey(params.groupId, params.roomKeyHex.trim());
    roomKeySavedThisAttempt = true;
  }

  const roomKeyPresent = Boolean((await roomKeyStore.getRoomKey(params.groupId))?.trim());
  if (!roomKeyPresent) {
    return failedActivation(
      "room_key_missing",
      "Community room key is required before join can complete.",
    );
  }

  const relayUrl = params.relayUrl;
  const relayTransportReady = hasWritableCommunityRelayTransport(relayUrl);
  const devCoordinationOnly = isCoordinationOnlyWorkspaceDevMode();
  let activationRelayUrl = relayUrl;

  if (relayTransportReady) {
    params.addRelay({ url: relayUrl });
    if (typeof params.pool.addTransientRelay === "function") {
      params.pool.addTransientRelay(relayUrl);
    }
  }

  if (!devCoordinationOnly && relayTransportReady) {
    const calibration = await ensureWorkspaceRelayTransportReady({
      rawUrl: relayUrl,
      pool: params.pool,
      timeoutMs: 6000,
    });
    activationRelayUrl = calibration.canonicalUrl || relayUrl;
    if (activationRelayUrl !== relayUrl) {
      params.addRelay({ url: activationRelayUrl });
      if (typeof params.pool.addTransientRelay === "function") {
        params.pool.addTransientRelay(activationRelayUrl);
      }
    }
  }

  const activation = await runWorkspaceMembershipActivation({
    context: "join",
    displayName: params.displayName,
    communityId: params.communityId,
    groupId: params.groupId,
    relayUrl: activationRelayUrl,
    memberPubkey: params.memberPubkey,
    actorPubkey: params.actorPubkey,
    actorPrivateKeyHex: params.actorPrivateKeyHex,
    pool: params.pool,
    addRelay: params.addRelay,
    openRelayUrls: params.openRelayUrls,
    nip29JoinJson: params.nip29JoinJson,
    sealedJoinJson: params.sealedJoinJson,
    requireHealthyCoordination: true,
  });

  let coordinationDirectory = await refreshCoordinationMembershipDirectory({
    communityId: params.communityId,
    forceFull: true,
    profileId,
    roomKeyMaterialization: {
      localPubkey: params.memberPubkey,
      localPrivateKeyHex: params.actorPrivateKeyHex,
      groupId: params.groupId,
    },
  });
  const coordinationSynced = activation.coordination.status === "synced";
  const coordinationActorActive = coordinationDirectory
    ? isPubkeyActiveInManagedWorkspace({
      communityId: params.communityId,
      materialization: coordinationDirectory,
      updatedAtUnixMs: Date.now(),
    }, params.memberPubkey)
    : false;

  const joinSuccessful = isManagedWorkspaceJoinSuccessful({
    roomKeyPresent,
    coordinationSynced,
    coordinationActorActive,
    activation,
  });

  const health = buildJoinHealthSnapshot({
    communityId: params.communityId,
    memberPubkey: params.memberPubkey,
    relayUrl,
    activation,
    coordinationDirectory,
    roomKeyPresent,
  });

  if (!joinSuccessful) {
    if (roomKeySavedThisAttempt) {
      await rollbackJoinRoomKeyAttempt(params.groupId, priorRoomKeyHex);
    }
    return buildJoinFailureResult({
      activation,
      health,
      errorMessage: "activation_incomplete",
      userFacingMessage: activation.summary.detail
        ? `${activation.summary.title} ${activation.summary.detail}`
        : activation.summary.title,
    });
  }

  coordinationDirectory = await refreshCoordinationMembershipDirectory({
    communityId: params.communityId,
    forceFull: true,
    profileId,
    roomKeyMaterialization: {
      localPubkey: params.memberPubkey,
      localPrivateKeyHex: params.actorPrivateKeyHex,
      groupId: params.groupId,
    },
  });

  if (coordinationSynced) {
    await publishSelfCoordinationRoomKeyWrapAfterJoin({
      communityId: params.communityId,
      groupId: params.groupId,
      memberPubkey: params.memberPubkey,
      actorPubkey: params.actorPubkey,
      actorPrivateKeyHex: params.actorPrivateKeyHex,
      roomKeyHex: params.roomKeyHex,
    });
  }

  const joinedGroup: GroupConversation = {
    kind: "group",
    id: toGroupConversationId({
      groupId: params.groupId,
      relayUrl: activation.relay.canonicalUrl || relayUrl,
      communityId: params.communityId,
    }),
    communityId: params.communityId,
    groupId: params.groupId,
    relayUrl: activation.relay.canonicalUrl || relayUrl,
    displayName: params.displayName ?? params.groupId,
    memberPubkeys: [params.memberPubkey],
    lastMessage: "Joined workspace community",
    unreadCount: 0,
    lastMessageTime: new Date(),
    access: "open",
    memberCount: 1,
    adminPubkeys: [],
    communityMode: "managed_workspace",
  };

  persistCommunityMembershipLedgerMutation(
    params.memberPubkey,
    {
      reason: "runtime_join_confirmed",
      entry: toCommunityMembershipLedgerEntryFromGroup(joinedGroup, { status: "joined" }),
    },
    { profileId },
  );
  upsertWorkspaceGroupMetadata(params.memberPubkey, profileId, joinedGroup);

  const finalHealth = buildJoinHealthSnapshot({
    communityId: params.communityId,
    memberPubkey: params.memberPubkey,
    relayUrl,
    activation,
    coordinationDirectory,
    roomKeyPresent: true,
  });

  return {
    ok: true,
    group: joinedGroup,
    activation,
    health: finalHealth,
  };
};
