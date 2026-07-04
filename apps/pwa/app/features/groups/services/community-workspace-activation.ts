import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { publishCommunityInviteRelayJoin } from "./community-invite-relay-join";
import { describeCoordinationFetchError } from "./community-coordination-fetch";
import { probeCoordinationHealth } from "./community-coordination-health";
import { publishCoordinationMembershipDelta } from "./community-coordination-membership-client";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import { publishViaEphemeralLocalWorkspaceSocket } from "./local-workspace-relay-publish";
import { isLocalWorkspaceRelayHost } from "./workspace-relay-url";
import { ensureWorkspaceMembershipSyncMode } from "./community-workspace-membership";
import {
  expandWorkspaceRelayUrlCandidates,
  normalizeWorkspaceRelayUrl,
  resolveMatchingOpenRelayUrl,
  workspaceRelayUrlsMatch,
} from "./workspace-relay-url";
import {
  prepareWorkspaceRelayForJoin,
  type WorkspaceRelayPoolTransport,
} from "./workspace-relay-calibrator";

const PENDING_ACTIVATION_STORAGE_PREFIX = "obscur.community.workspace_activation_pending.v1";
const PENDING_ACTIVATION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type WorkspaceActivationEvidenceStatus =
  | "synced"
  | "pending"
  | "skipped"
  | "failed";

export type WorkspaceActivationRecoveryAction =
  | "retry_network"
  | "reconcile_membership"
  | "configure_relays"
  | "start_coordination";

export type WorkspaceActivationRelayEvidence = Readonly<{
  status: WorkspaceActivationEvidenceStatus;
  canonicalUrl: string;
  publishTargets: ReadonlyArray<string>;
  lastError?: string;
}>;

export type WorkspaceActivationCoordinationEvidence = Readonly<{
  status: WorkspaceActivationEvidenceStatus;
  lastError?: string;
}>;

export type WorkspaceActivationSummary = Readonly<{
  severity: "success" | "partial" | "failed";
  title: string;
  detail?: string;
  recovery: ReadonlyArray<WorkspaceActivationRecoveryAction>;
}>;

export type WorkspaceMembershipActivationResult = Readonly<{
  relay: WorkspaceActivationRelayEvidence;
  coordination: WorkspaceActivationCoordinationEvidence;
  summary: WorkspaceActivationSummary;
}>;

export type WorkspaceRelayPublishPool = Readonly<{
  publishToUrls?: (
    urls: ReadonlyArray<string>,
    payload: string,
  ) => Promise<Readonly<{
    success: boolean;
    overallError?: string;
    results?: ReadonlyArray<Readonly<{ success: boolean; error?: string }>>;
  }>>;
  publishToUrl?: (url: string, payload: string) => Promise<Readonly<{ success: boolean; error?: string }>>;
  publishToRelay?: (url: string, payload: string) => Promise<Readonly<{ success: boolean; error?: string }>>;
  publishToAll?: (payload: string) => Promise<Readonly<{ success: boolean; overallError?: string }>>;
}>;

export type PendingWorkspaceActivationRecord = Readonly<{
  id: string;
  communityId: string;
  groupId: string;
  relayUrl: string;
  actorPubkey: PublicKeyHex;
  kind: "join";
  createdAtUnixMs: number;
  lastAttemptAtUnixMs: number;
  attemptCount: number;
}>;

const defaultRelayEvidence = (canonicalUrl: string): WorkspaceActivationRelayEvidence => ({
  status: "failed",
  canonicalUrl,
  publishTargets: [],
  lastError: "relay_unavailable",
});

const defaultCoordinationEvidence = (): WorkspaceActivationCoordinationEvidence => ({
  status: "failed",
  lastError: "coordination_unavailable",
});

const pendingStorageKey = (profileId?: string): string => (
  getScopedStorageKey(PENDING_ACTIVATION_STORAGE_PREFIX, profileId ?? getResolvedProfileId())
);

export const resolveWorkspaceActivationPublishTargets = (params: Readonly<{
  canonicalUrl: string;
  pool?: WorkspaceRelayPoolTransport;
  openRelayUrls?: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
  const candidates = expandWorkspaceRelayUrlCandidates(params.canonicalUrl);
  const targets = new Set<string>();

  const snapshot = params.pool?.getWritableRelaySnapshot?.(candidates);
  (snapshot?.writableRelayUrls ?? []).forEach((url) => {
    if (candidates.some((candidate) => workspaceRelayUrlsMatch(candidate, url))) {
      targets.add(normalizeWorkspaceRelayUrl(url));
    }
  });

  (params.openRelayUrls ?? []).forEach((openUrl) => {
    const matched = resolveMatchingOpenRelayUrl(params.canonicalUrl, [openUrl]);
    if (matched) {
      targets.add(normalizeWorkspaceRelayUrl(matched));
    }
  });

  if (targets.size === 0) {
    const canonical = normalizeWorkspaceRelayUrl(params.canonicalUrl);
    if (canonical.length > 0) {
      targets.add(canonical);
    }
  }

  return Array.from(targets).sort((left, right) => {
    const leftWritable = (snapshot?.writableRelayUrls ?? []).some((url) => workspaceRelayUrlsMatch(url, left));
    const rightWritable = (snapshot?.writableRelayUrls ?? []).some((url) => workspaceRelayUrlsMatch(url, right));
    if (leftWritable !== rightWritable) {
      return leftWritable ? -1 : 1;
    }
    return 0;
  }).slice(0, 1);
};

export type RelayScopedPublishResult = Readonly<{
  success: boolean;
  error?: string;
}>;

export const createWorkspaceActivationPublisher = (
  pool: WorkspaceRelayPublishPool,
  publishTargets: ReadonlyArray<string>,
): ((payload: string) => Promise<RelayScopedPublishResult>) => (
  async (payload: string) => {
    const urls = publishTargets.filter((url) => url.trim().length > 0);
    if (urls.length === 0) {
      return { success: false, error: "no_publish_targets" };
    }
    const finish = async (): Promise<RelayScopedPublishResult> => {
      try {
        if (typeof pool.publishToUrls === "function") {
          const result = await pool.publishToUrls(urls, payload);
          return {
            success: result.success,
            error: result.success
              ? undefined
              : (result.overallError ?? result.results?.find((entry) => !entry.success)?.error),
          };
        }
        if (typeof pool.publishToUrl === "function") {
          for (const url of urls) {
            const result = await pool.publishToUrl(url, payload);
            if (result.success) {
              return { success: true };
            }
          }
          const last = await pool.publishToUrl(urls[urls.length - 1]!, payload);
          return { success: false, error: last.error };
        }
        if (typeof pool.publishToRelay === "function") {
          for (const url of urls) {
            const result = await pool.publishToRelay(url, payload);
            if (result.success) {
              return { success: true };
            }
          }
          const last = await pool.publishToRelay(urls[urls.length - 1]!, payload);
          return { success: false, error: last.error };
        }
        if (typeof pool.publishToAll === "function") {
          const result = await pool.publishToAll(payload);
          return {
            success: result.success,
            error: result.success ? undefined : result.overallError,
          };
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      return { success: false, error: "publish_pool_unavailable" };
    };

    const primary = await finish();
    if (primary.success) {
      return primary;
    }

    const localTarget = urls.find((url) => isLocalWorkspaceRelayHost(url));
    if (!localTarget) {
      return primary;
    }

    const ephemeral = await publishViaEphemeralLocalWorkspaceSocket(localTarget, payload);
    if (ephemeral.success) {
      return { success: true };
    }

    return {
      success: false,
      error: ephemeral.error ?? primary.error ?? "relay_publish_failed",
    };
  }
);

export const prepareWorkspaceActivationTransport = async (params: Readonly<{
  rawRelayUrl: string;
  pool: WorkspaceRelayPoolTransport;
  addRelay: (relayParams: Readonly<{ url: string }>) => void;
  openRelayUrls?: ReadonlyArray<string>;
  timeoutMs?: number;
}>): Promise<Readonly<{
  canonicalUrl: string;
  publishTargets: ReadonlyArray<string>;
  transportAvailable: boolean;
}>> => {
  const raw = params.rawRelayUrl.trim();
  if (!hasWritableCommunityRelayTransport(raw)) {
    const canonicalUrl = normalizeWorkspaceRelayUrl(raw);
    return {
      canonicalUrl,
      publishTargets: [],
      transportAvailable: false,
    };
  }

  const canonicalUrl = await prepareWorkspaceRelayForJoin({
    rawUrl: raw,
    pool: params.pool,
    addRelay: params.addRelay,
    timeoutMs: params.timeoutMs ?? 6000,
  });

  const publishTargets = resolveWorkspaceActivationPublishTargets({
    canonicalUrl: canonicalUrl || raw,
    pool: params.pool,
    openRelayUrls: params.openRelayUrls,
  });

  const snapshot = params.pool.getWritableRelaySnapshot?.(
    expandWorkspaceRelayUrlCandidates(canonicalUrl || raw),
  );
  const transportAvailable = (snapshot?.writableRelayUrls?.length ?? 0) > 0
    || publishTargets.some((target) => Boolean(
      resolveMatchingOpenRelayUrl(target, params.openRelayUrls ?? []),
    ));

  return {
    canonicalUrl: canonicalUrl || normalizeWorkspaceRelayUrl(raw),
    publishTargets,
    transportAvailable,
  };
};

export const publishWorkspaceRelayJoinEvidence = async (params: Readonly<{
  pool: WorkspaceRelayPublishPool & WorkspaceRelayPoolTransport;
  addRelay: (relayParams: Readonly<{ url: string }>) => void;
  rawRelayUrl: string;
  openRelayUrls?: ReadonlyArray<string>;
  nip29JoinJson: string;
  sealedJoinJson: string;
  timeoutMs?: number;
}>): Promise<WorkspaceActivationRelayEvidence> => {
  const transport = await prepareWorkspaceActivationTransport({
    rawRelayUrl: params.rawRelayUrl,
    pool: params.pool,
    addRelay: params.addRelay,
    openRelayUrls: params.openRelayUrls,
    timeoutMs: params.timeoutMs,
  });

  if (!hasWritableCommunityRelayTransport(transport.canonicalUrl)) {
    return {
      status: "skipped",
      canonicalUrl: transport.canonicalUrl,
      publishTargets: [],
      lastError: "relay_transport_not_configured",
    };
  }

  if (transport.publishTargets.length === 0) {
    return {
      status: "failed",
      canonicalUrl: transport.canonicalUrl,
      publishTargets: [],
      lastError: "no_writable_relay_targets",
    };
  }

  const publish = createWorkspaceActivationPublisher(params.pool, transport.publishTargets);
  const relayStatus = await publishCommunityInviteRelayJoin({
    publish: async (payload) => (await publish(payload)).success,
    nip29JoinJson: params.nip29JoinJson,
    sealedJoinJson: params.sealedJoinJson,
    maxAttempts: 4,
    baseBackoffMs: 300,
  });

  if (relayStatus === "joined") {
    return {
      status: "synced",
      canonicalUrl: transport.canonicalUrl,
      publishTargets: transport.publishTargets,
    };
  }

  return {
    status: "pending",
    canonicalUrl: transport.canonicalUrl,
    publishTargets: transport.publishTargets,
    lastError: transport.transportAvailable ? "relay_publish_failed" : "relay_not_connected",
  };
};

export const publishWorkspaceCoordinationJoinEvidence = async (params: Readonly<{
  communityId: string;
  memberPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
  requireHealthy?: boolean;
}>): Promise<WorkspaceActivationCoordinationEvidence> => {
  ensureWorkspaceMembershipSyncMode();
  const health = await probeCoordinationHealth({ force: true });
  if (!health.configured || !health.baseUrl) {
    return {
      status: "skipped",
      lastError: "coordination_not_configured",
    };
  }
  if (params.requireHealthy && !health.healthy) {
    return {
      status: "pending",
      lastError: health.errorMessage ?? "coordination_unhealthy",
    };
  }

  const result = await publishCoordinationMembershipDelta({
    communityId: params.communityId,
    action: "join",
    subjectPubkey: params.memberPubkey,
    actorPubkey: params.actorPubkey,
    actorPrivateKeyHex: params.actorPrivateKeyHex,
  });

  if (result.success) {
    return { status: "synced" };
  }

  return {
    status: "pending",
    lastError: result.errorMessage ?? "coordination_publish_failed",
  };
};

export const summarizeWorkspaceActivation = (params: Readonly<{
  relay: WorkspaceActivationRelayEvidence;
  coordination: WorkspaceActivationCoordinationEvidence;
  context: "create" | "join";
  displayName?: string;
}>): WorkspaceActivationSummary => {
  const relayOk = (() => {
    if (params.relay.status === "skipped") {
      return true;
    }
    if (params.relay.status !== "synced") {
      return false;
    }
    // R4 T-2: synced without publish targets is not activation success.
    if (params.relay.publishTargets.length === 0) {
      return false;
    }
    return true;
  })();
  const coordinationOk = params.coordination.status === "synced" || params.coordination.status === "skipped";

  if (relayOk && coordinationOk) {
    return {
      severity: "success",
      title: params.context === "create"
        ? "Workspace community created"
        : `Joined ${params.displayName ?? "community"}`,
      recovery: [],
    };
  }

  const recovery = new Set<WorkspaceActivationRecoveryAction>();
  const detailParts: string[] = [];

  if (!relayOk) {
    const relayHint = params.relay.lastError?.trim();
    const relayWhitelistBlocked = relayHint
      ? /\bnot allowed to publish\b/i.test(relayHint)
      : false;
    detailParts.push(
      params.context === "create"
        ? `Community genesis event did not publish to ${params.relay.canonicalUrl || "the community relay"}.${
          relayHint ? ` (${relayHint})` : ""
        }`
        : params.relay.lastError === "relay_not_connected" || params.relay.lastError === "no_writable_relay_targets"
          ? `Community relay is not writable (${params.relay.canonicalUrl}). Start the relay (pnpm dev:relay:docker) and confirm it is enabled under Settings → Relays.`
          : `Relay join events did not publish to ${params.relay.canonicalUrl || "the community relay"}.${
            relayHint ? ` (${relayHint})` : ""
          }`,
    );
    if (relayWhitelistBlocked) {
      detailParts.push(
        "Local relay has pubkey_whitelist enabled with no matching key. Restart Docker relay after config fix: pnpm dev:relay:down && pnpm dev:relay:docker.",
      );
    }
    recovery.add("configure_relays");
    recovery.add("retry_network");
  }

  if (!coordinationOk) {
    detailParts.push(
      describeCoordinationFetchError(params.coordination.lastError),
    );
    recovery.add("start_coordination");
    recovery.add("reconcile_membership");
  }

  const severity: WorkspaceActivationSummary["severity"] = (relayOk || coordinationOk) ? "partial" : "failed";
  const title = params.context === "create"
    ? (severity === "partial"
      ? "Workspace community created locally; finishing network sync"
      : "Community not created — network sync failed")
    : (severity === "partial"
      ? `Joined ${params.displayName ?? "community"} locally; finishing network sync`
      : "Join recorded locally; network sync incomplete");

  return {
    severity,
    title,
    detail: detailParts.join(" "),
    recovery: Array.from(recovery),
  };
};

export const runWorkspaceMembershipActivation = async (params: Readonly<{
  context: "create" | "join";
  displayName?: string;
  communityId: string;
  groupId: string;
  relayUrl: string;
  memberPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
  pool: WorkspaceRelayPublishPool & WorkspaceRelayPoolTransport;
  addRelay: (relayParams: Readonly<{ url: string }>) => void;
  openRelayUrls?: ReadonlyArray<string>;
  nip29JoinJson?: string;
  sealedJoinJson?: string;
  includeRelay?: boolean;
  includeCoordination?: boolean;
  requireHealthyCoordination?: boolean;
}>): Promise<WorkspaceMembershipActivationResult> => {
  const includeRelay = params.includeRelay ?? hasWritableCommunityRelayTransport(params.relayUrl);
  const includeCoordination = params.includeCoordination ?? true;

  const [relay, coordination] = await Promise.all([
    includeRelay && params.nip29JoinJson && params.sealedJoinJson
      ? publishWorkspaceRelayJoinEvidence({
        pool: params.pool,
        addRelay: params.addRelay,
        rawRelayUrl: params.relayUrl,
        openRelayUrls: params.openRelayUrls,
        nip29JoinJson: params.nip29JoinJson,
        sealedJoinJson: params.sealedJoinJson,
      })
      : Promise.resolve({
        status: includeRelay ? "failed" : "skipped",
        canonicalUrl: normalizeWorkspaceRelayUrl(params.relayUrl),
        publishTargets: [],
        lastError: includeRelay ? "relay_events_missing" : undefined,
      } as WorkspaceActivationRelayEvidence),
    includeCoordination
      ? publishWorkspaceCoordinationJoinEvidence({
        communityId: params.communityId,
        memberPubkey: params.memberPubkey,
        actorPubkey: params.actorPubkey,
        actorPrivateKeyHex: params.actorPrivateKeyHex,
        requireHealthy: params.requireHealthyCoordination,
      })
      : Promise.resolve({ status: "skipped" } as WorkspaceActivationCoordinationEvidence),
  ]);

  const summary = summarizeWorkspaceActivation({
    relay,
    coordination,
    context: params.context,
    displayName: params.displayName,
  });

  if (summary.severity !== "success") {
    enqueuePendingWorkspaceActivation({
      communityId: params.communityId,
      groupId: params.groupId,
      relayUrl: relay.canonicalUrl || params.relayUrl,
      actorPubkey: params.actorPubkey,
    });
    logAppEvent({
      name: "groups.workspace_activation_partial",
      level: "warn",
      scope: { feature: "groups", action: "workspace_activation" },
      context: {
        context: params.context,
        communityId: params.communityId,
        relayStatus: relay.status,
        coordinationStatus: coordination.status,
      },
    });
  }

  return { relay, coordination, summary };
};

export const loadPendingWorkspaceActivations = (
  profileId?: string,
): ReadonlyArray<PendingWorkspaceActivationRecord> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(pendingStorageKey(profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ReadonlyArray<Partial<PendingWorkspaceActivationRecord>>;
    const now = Date.now();
    return parsed.filter((entry): entry is PendingWorkspaceActivationRecord => (
      typeof entry?.id === "string"
      && typeof entry.communityId === "string"
      && typeof entry.groupId === "string"
      && typeof entry.relayUrl === "string"
      && typeof entry.actorPubkey === "string"
      && typeof entry.createdAtUnixMs === "number"
      && now - entry.createdAtUnixMs < PENDING_ACTIVATION_MAX_AGE_MS
    ));
  } catch {
    return [];
  }
};

const savePendingWorkspaceActivations = (
  records: ReadonlyArray<PendingWorkspaceActivationRecord>,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(pendingStorageKey(profileId), JSON.stringify(records));
  } catch {
    // ignore quota
  }
};

export const enqueuePendingWorkspaceActivation = (params: Readonly<{
  communityId: string;
  groupId: string;
  relayUrl: string;
  actorPubkey: PublicKeyHex;
}>): void => {
  const profileId = getResolvedProfileId();
  const existing = loadPendingWorkspaceActivations(profileId);
  const id = `${params.communityId}@@${params.groupId}`;
  const now = Date.now();
  const nextRecord: PendingWorkspaceActivationRecord = {
    id,
    communityId: params.communityId,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    actorPubkey: params.actorPubkey,
    kind: "join",
    createdAtUnixMs: existing.find((entry) => entry.id === id)?.createdAtUnixMs ?? now,
    lastAttemptAtUnixMs: now,
    attemptCount: (existing.find((entry) => entry.id === id)?.attemptCount ?? 0) + 1,
  };
  savePendingWorkspaceActivations([
    ...existing.filter((entry) => entry.id !== id),
    nextRecord,
  ], profileId);
};

export const clearPendingWorkspaceActivation = (
  communityId: string,
  groupId: string,
  profileId?: string,
): void => {
  const id = `${communityId}@@${groupId}`;
  savePendingWorkspaceActivations(
    loadPendingWorkspaceActivations(profileId).filter((entry) => entry.id !== id),
    profileId,
  );
};

export {
  defaultRelayEvidence,
  defaultCoordinationEvidence,
};
