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
import { isCoordinationConfigured } from "@/app/features/groups/services/community-membership-sync-mode";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  toCommunityMembershipLedgerEntryFromGroup,
} from "@/app/features/groups/services/community-membership-ledger";
import { persistCommunityMembershipLedgerMutation } from "@/app/features/groups/services/community-membership-mutation-owner";
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
  nip29JoinJson?: string;
  sealedJoinJson?: string;
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
  await refreshCoordinationMembershipDirectory({ communityId, forceFull: true, profileId });
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

export const joinManagedWorkspaceMembership = async (
  params: JoinManagedWorkspaceMembershipParams,
): Promise<WorkspaceMembershipActivationResult> => {
  if (!isWorkspaceKernelMembershipPortReady()) {
    return {
      relay: {
        status: "failed",
        canonicalUrl: params.relayUrl,
        publishTargets: [],
        lastError: "workspace_kernel_membership_port_not_ready",
      },
      coordination: { status: "failed", lastError: "workspace_kernel_membership_port_not_ready" },
      summary: {
        severity: "failed",
        title: "Join failed",
        detail: "Workspace kernel membership port is not ready.",
        recovery: ["start_coordination"],
      },
    };
  }

  ensureWorkspaceMembershipSyncMode();
  const result = await runWorkspaceMembershipActivation({
    context: "join",
    displayName: params.displayName,
    communityId: params.communityId,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
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

  const profileId = getResolvedProfileId();
  const coordinationJoinConfirmed = result.coordination.status === "synced";
  if (coordinationJoinConfirmed || result.summary.severity === "success") {
    await refreshCoordinationMembershipDirectory({
      communityId: params.communityId,
      forceFull: true,
      profileId,
    });
    const joinedGroup: GroupConversation = {
      kind: "group",
      id: toGroupConversationId({
        groupId: params.groupId,
        relayUrl: result.relay.canonicalUrl || params.relayUrl,
        communityId: params.communityId,
      }),
      communityId: params.communityId,
      groupId: params.groupId,
      relayUrl: result.relay.canonicalUrl || params.relayUrl,
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
  }

  return result;
};
