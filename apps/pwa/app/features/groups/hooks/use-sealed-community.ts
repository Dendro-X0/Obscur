"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityControlEvent } from "@dweb/core/community-control-event-contracts";
import type { CommunityContentTimelineEntry } from "@dweb/core/community-projection-contracts";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "../../crypto/crypto-interfaces";
import { cryptoService } from "../../crypto/crypto-service";
import { roomKeyStore } from "../../crypto/room-key-store";
import { logAppEvent } from "@/app/shared/log-app-event";
import { CommunityAccessGuard } from "@/app/features/groups/services/community-access-guard";
import { GroupService } from "@/app/features/groups/services/group-service";
import { toast } from "../../../components/ui/toast";
import type { GroupRole, GroupMembershipStatus, GroupMetadata, GroupAccessMode, JoinRequestState } from "../types";
import {
  transitionCommunityConnection,
  transitionMembershipStatus,
} from "../../messaging/state-machines/community-membership-machine";
import { recordCommunityLeaveProof } from "../services/community-leave-proof-service";
import {
  enqueueCommunityLeaveOutboxItem,
  recordCommunityLeaveRelayPublishOutcome,
} from "../services/community-leave-outbox";
import { messageBus } from "../../messaging/services/message-bus";
import type { Message, JoinRequestBlockReason } from "../../messaging/types";
import { toGroupConversationId } from "../utils/group-conversation-id";
import { normalizeRelayUrl as normalizeRelayUrlBase } from "@dweb/nostr/relay-utils";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { isTauri, dbInsertGroupMessage, dbInsertGroupTombstone } from "@dweb/db";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import {
    dispatchCommunityKnownParticipantsObserved,
    dispatchGroupDescriptorUpdated,
    dispatchGroupMembershipSnapshot,
    dispatchGroupRemove,
} from "@/app/features/profiles/services/profile-bus-dispatch";
import { pickPreferredCommunityDisplayName } from "../services/community-display-name";
import {
  assertRelayPublishSuccess,
  formatRelayPublishFailureMessage,
  resolveUserFacingErrorMessage,
} from "@/app/features/relays/services/relay-publish-user-copy";
import {
  computeGovernanceQuorumThreshold,
  createEmptyCommunityGovernanceState,
  hasGovernanceQuorum,
  hasGovernanceRejectionQuorum,
  hasGovernanceVoteTie,
  listExpiredOpenGovernanceProposalIds,
  type CommunityGovernanceReducerState,
  type GovernanceProposalRecord,
  type GovernanceReducerEvent,
} from "../services/community-governance-reducer";
import {
  getCommunityGovernanceReducerState,
  hydrateCommunityGovernanceState,
  ingestCommunityGovernanceEvent,
  subscribeCommunityGovernance,
} from "../services/community-governance-projection";
import { computeGovernanceProposalExpiresAtUnixMs } from "../services/community-governance-policy";
import { toGovernanceReducerEventFromSealed } from "../services/community-governance-sealed";
import {
  parseStoredCommunityGovernanceState,
  serializeCommunityGovernanceState,
} from "../services/community-governance-local-cache";
import type { CommunityGovernanceVote } from "@dweb/core/community-control-event-contracts";
import { incrementAbuseMetric } from "@/app/shared/abuse-observability";
import { recordMalformedEventQuarantinedRisk } from "@/app/shared/sybil-risk-signals";
import {
  useCommunityMembershipCRDT,
} from "./use-community-membership-crdt";
import {
  projectCommunityMemberRoster,
} from "../services/community-member-roster-projection";
import {
  canApplyRelayInferredMemberRemoval,
  resolveRelayEvidenceConfidence,
  type RelayEvidenceConfidence,
  type RelayEvidencePolicyParams,
} from "../services/community-relay-evidence-policy";
import { isSuppressedCommunityGroupMessageIdentity } from "../services/community-group-message-suppression";
import {
  loadCommunityTerminalMembershipCache,
  reinstateCommunityMemberTerminalEvidence,
  saveCommunityTerminalMembershipCache,
  stripTerminalCommunityMembersWithActiveEvidence,
} from "../services/community-terminal-membership-cache";
import { resolveAuthorEvidencePubkeysFromCommunityMessages } from "../services/community-visible-members";
import {
  filterTerminalMembersWithoutParticipationEvidence,
  resolveCommunityParticipationPubkeys,
  shouldSuppressStaleCommunityMemberRemoval,
} from "../utils/community-membership-participation-evidence";
import {
  classifyRelayMembershipEvent,
  RELAY_KIND_MEMBERSHIP_SIGNAL,
} from "../services/community-relay-membership-interop";
import { COMMUNITY_MEMBERSHIP_RESTATE_INTERVAL_MS } from "../services/community-membership-evidence-actions";
import { persistCommunityGovernanceMemberExpelled } from "../services/community-governance-mutation-owner";
import type { GroupConversation } from "../../messaging/types";
import { subscribeGroupInviteAcceptedDual } from "@/app/features/profiles/services/subscribe-group-invite-accepted-dual";
import { useOptionalProfileMessageBus } from "@/app/features/profiles/providers/profile-runtime-provider";

export { GROUP_MEMBERSHIP_SNAPSHOT_EVENT, COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT } from "@/app/features/profiles/services/profile-bus-dispatch";

export const normalizeRelayUrl = (relayUrl: string): string => {
  const normalized = normalizeRelayUrlBase(relayUrl);
  if (/^[a-z]+:\/\/$/i.test(normalized)) return normalized;
  return normalized.replace(/\/+$/g, "");
};

type NostrPool = Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => string;
  unsubscribe: (id: string) => void;
  publishToUrl?: (url: string, payload: string) => Promise<PublishResult>;
  publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<MultiRelayPublishResult>;
  publishToRelay?: (url: string, payload: string) => Promise<PublishResult>;
  publishToAll: (payload: string) => Promise<MultiRelayPublishResult>;
}>;

type MultiRelayPublishResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: ReadonlyArray<Readonly<{ success: boolean; relayUrl: string; error?: string; latency?: number }>>;
  overallError?: string;
}>;

type PublishResult = Readonly<{
  success: boolean;
  relayUrl: string;
  error?: string;
  latency?: number;
}>;

type NostrFilter = Readonly<{
  kinds?: ReadonlyArray<number>;
  authors?: ReadonlyArray<string>;
  since?: number;
  limit?: number;
  "#h"?: ReadonlyArray<string>;
  "#d"?: ReadonlyArray<string>;
}>;

type RelayOkFeedback = Readonly<{
  accepted: boolean;
  message: string;
}>;

type RelayFeedback = Readonly<{
  lastOk?: RelayOkFeedback;
  lastNotice?: string;
  rejectionStats?: Readonly<{
    totalRejected: number;
    relayScopeMismatch: number;
    lastReason?: string;
    lastReceivedRelay?: string;
    updatedAt: number;
  }>;
}>;

export type GroupMessageEvent = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
}>;

type Nip29GroupState = Readonly<{
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  joinRequestState: JoinRequestState;
  joinRequestBlockReason?: JoinRequestBlockReason;
  metadata?: GroupMetadata;
  membership: Readonly<{ status: GroupMembershipStatus; role: GroupRole }>;
  messages: ReadonlyArray<GroupMessageEvent>;
  joinRequests: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; createdAt: number; content: string }>>;
  admins: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>;
  relayFeedback: RelayFeedback;
  kickVotes: Readonly<Record<PublicKeyHex, string[]>>;
  expelledMembers: ReadonlyArray<PublicKeyHex>;
  leftMembers: ReadonlyArray<PublicKeyHex>;
  disbandedAt?: number;
}>;

type UseSealedCommunityParams = Readonly<{
  pool: NostrPool;
  relayUrl: string;
  /** Optional extra relays for this community (operator / descriptor pool). Publishes to primary + these when set. */
  communityRelayBroadcastUrls?: ReadonlyArray<string>;
  groupId: string;
  communityId?: string;
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
  enabled?: boolean;
  initialMembers?: ReadonlyArray<PublicKeyHex>;
}>;

export type UseSealedCommunityResult = Readonly<{
  state: Nip29GroupState;
  contentTimeline: ReadonlyArray<CommunityContentTimelineEntry>;
  refresh: () => void;
  /** Clears local left/expelled overlay (storage + in-memory). Relay leave/expel events may re-apply on sync. */
  clearLocalTerminalMembershipEvidence: () => void;
  requestJoin: () => Promise<void>;
  approveJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  denyJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  approveAllJoinRequests: () => Promise<void>;
  denyAllJoinRequests: () => Promise<void>;
  sendMessage: (params: Readonly<{ content: string }>) => Promise<void>;
  sendVoteKick: (targetPubkey: string, reason?: string) => Promise<void>;
  proposeDescriptorUpdate: (params: Readonly<GroupMetadata>) => Promise<void>;
  proposeExpelMember: (params: Readonly<{ targetPublicKeyHex: PublicKeyHex; reason?: string }>) => Promise<void>;
  castGovernanceVote: (params: Readonly<{ proposalId: string; vote: CommunityGovernanceVote }>) => Promise<void>;
  rotateRoomKey: () => Promise<void>;
  updateMetadata: (
    params: Readonly<GroupMetadata>,
    options?: Readonly<{ governanceProposalId?: string }>,
  ) => Promise<void>;
  setGroupStatus: (params: Readonly<{ access: "open" | "invite-only" | "discoverable" }>) => Promise<void>;
  putUser: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  removeUser: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  promoteUser: (params: Readonly<{ publicKeyHex: PublicKeyHex; role: "owner" | "moderator" }>) => Promise<void>;
  demoteUser: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  leaveGroup: () => Promise<void>;
  deleteMessage: (params: Readonly<{ eventId: string; reason?: string }>) => Promise<void>;
  members: ReadonlyArray<PublicKeyHex>;
  admins: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>;
}>;

const GROUP_KIND_SEALED = 10105;
const GROUP_KIND_DELETE = 5;
const GROUP_KIND_METADATA = 39000;
const GROUP_KIND_MEMBERS = 39002;
const GROUP_KIND_REQUEST_JOIN = 9021;
const GROUP_KIND_LEAVE = 9022;
const MAX_GROUP_MESSAGES = 200;
const GROUP_DELETE_TOMBSTONE_TTL_MS = 2 * 60 * 1000;
const JOIN_REQUEST_PENDING_PREFIX = "obscur:groups:join-request-pending:v1";
const JOIN_REQUEST_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const JOIN_REQUEST_COOLDOWN_MS = 2 * 60 * 1000;
const JOIN_REQUEST_DENIED_TTL_MS = 30 * 60 * 1000;

type JoinRequestStorageRecord = Readonly<{
  status: Exclude<JoinRequestState, "none" | "expired">;
  updatedAtMs: number;
  cooldownUntilMs?: number;
}>;

const toJoinRequestPendingKey = (params: Readonly<{
  relayUrl: string;
  groupId: string;
  myPublicKeyHex: PublicKeyHex;
  profileId?: string;
}>): string => {
  const base = [
    JOIN_REQUEST_PENDING_PREFIX,
    params.myPublicKeyHex,
    normalizeRelayUrl(params.relayUrl),
    params.groupId
  ].join(":");
  return getScopedStorageKey(base, params.profileId ?? getResolvedProfileId());
};

const getJoinRequestStorageState = (storageKey: string): Readonly<{
  state: JoinRequestState;
  remainingCooldownMs?: number;
}> => {
  if (typeof window === "undefined") return { state: "none" };
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return { state: "none" };
  try {
    const parsed = JSON.parse(raw) as JoinRequestStorageRecord;
    if (typeof parsed.updatedAtMs !== "number" || typeof parsed.status !== "string") {
      window.localStorage.removeItem(storageKey);
      return { state: "none" };
    }
    if (parsed.status === "pending" && (Date.now() - parsed.updatedAtMs) > JOIN_REQUEST_PENDING_TTL_MS) {
      window.localStorage.removeItem(storageKey);
      return { state: "expired" };
    }
    if (parsed.status === "cooldown") {
      const remainingCooldownMs = (parsed.cooldownUntilMs ?? 0) - Date.now();
      if (remainingCooldownMs <= 0) {
        window.localStorage.removeItem(storageKey);
        return { state: "none" };
      }
      return { state: "cooldown", remainingCooldownMs };
    }
    if (parsed.status === "denied") {
      if ((Date.now() - parsed.updatedAtMs) > JOIN_REQUEST_DENIED_TTL_MS) {
        window.localStorage.removeItem(storageKey);
        return { state: "expired" };
      }
      return { state: "denied" };
    }
    return { state: parsed.status };
  } catch {
    window.localStorage.removeItem(storageKey);
    return { state: "none" };
  }
};

const blockReasonFromJoinState = (state: JoinRequestState): JoinRequestBlockReason | undefined => {
  if (state === "pending") return "pending_request_exists";
  if (state === "cooldown") return "cooldown_active";
  if (state === "denied") return "denied_request";
  return undefined;
};

const classifyJoinRequestFailure = (error: unknown): "denied" | "cooldown" => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/(denied|forbidden|not allowed|permission|not authorized|unauthorized|blocked)/i.test(message)) {
    return "denied";
  }
  return "cooldown";
};

const setJoinRequestStorageState = (
  storageKey: string,
  params: Readonly<{ state: Exclude<JoinRequestState, "none" | "expired">; cooldownMs?: number }>
): void => {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const next: JoinRequestStorageRecord = params.state === "cooldown"
    ? {
      status: "cooldown",
      updatedAtMs: now,
      cooldownUntilMs: now + Math.max(1_000, params.cooldownMs ?? JOIN_REQUEST_COOLDOWN_MS)
    }
    : {
      status: params.state,
      updatedAtMs: now
    };
  window.localStorage.setItem(storageKey, JSON.stringify(next));
};

const clearJoinRequestPending = (storageKey: string | null): void => {
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
};

export const mergeGroupMessagesDescending = (params: Readonly<{
  previous: ReadonlyArray<GroupMessageEvent>;
  incoming: ReadonlyArray<GroupMessageEvent>;
}>): ReadonlyArray<GroupMessageEvent> => {
  if (params.incoming.length === 0) return params.previous;
  if (params.previous.length === 0) {
    return [...params.incoming]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, MAX_GROUP_MESSAGES);
  }

  // Fast path: most realtime updates are a single event at either timeline boundary.
  if (params.incoming.length === 1) {
    const incoming = params.incoming[0];
    const existingIndex = params.previous.findIndex((message) => message.id === incoming.id);
    if (existingIndex >= 0) {
      const existing = params.previous[existingIndex];
      if (
        existing.created_at === incoming.created_at &&
        existing.content === incoming.content &&
        existing.pubkey === incoming.pubkey
      ) {
        return params.previous;
      }

      const replaced = [...params.previous];
      replaced[existingIndex] = incoming;
      const prevIsOrdered = existingIndex === 0 || replaced[existingIndex - 1].created_at >= incoming.created_at;
      const nextIsOrdered = existingIndex === replaced.length - 1 || replaced[existingIndex + 1].created_at <= incoming.created_at;
      if (prevIsOrdered && nextIsOrdered) {
        return replaced.slice(0, MAX_GROUP_MESSAGES);
      }
    } else {
      if (incoming.created_at >= params.previous[0].created_at) {
        return [incoming, ...params.previous].slice(0, MAX_GROUP_MESSAGES);
      }
      if (incoming.created_at <= params.previous[params.previous.length - 1].created_at) {
        return [...params.previous, incoming].slice(0, MAX_GROUP_MESSAGES);
      }
    }
  }

  const byId = new Map<string, GroupMessageEvent>();
  params.previous.forEach((message) => {
    byId.set(message.id, message);
  });
  params.incoming.forEach((message) => {
    byId.set(message.id, message);
  });
  return Array.from(byId.values())
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, MAX_GROUP_MESSAGES);
};



const UNKNOWN_RELAY_SENTINELS = new Set(["unknown", "null", "undefined", "n/a", "none"]);

export const isValidScopedRelayUrl = (relayUrl: string): boolean => {
  const normalized = normalizeRelayUrl(relayUrl);
  if (normalized.length === 0) return false;
  if (UNKNOWN_RELAY_SENTINELS.has(normalized)) return false;
  return /^wss?:\/\/.+/.test(normalized);
};

export const toScopedRelayUrl = (relayUrl: string): string | null => {
  return isValidScopedRelayUrl(relayUrl) ? normalizeRelayUrl(relayUrl) : null;
};

export const isScopedRelayEvent = (params: Readonly<{ scopedRelayUrl: string; eventRelayUrl: string }>): boolean => {
  return normalizeRelayUrl(params.eventRelayUrl) === normalizeRelayUrl(params.scopedRelayUrl);
};

export const hasCommunityBindingTag = (params: Readonly<{ event: NostrEvent; groupId: string }>): boolean => {
  const tags = Array.isArray(params.event.tags) ? params.event.tags : [];
  return tags.some((tag) => {
    if (!Array.isArray(tag) || tag.length < 2) return false;
    const key = tag[0];
    const value = tag[1];
    if (typeof key !== "string" || typeof value !== "string") return false;
    if (key !== "h" && key !== "d") return false;
    return value === params.groupId;
  });
};

const createInitialState = (): Nip29GroupState => {
  return {
    status: "idle",
    joinRequestState: "none",
    membership: { status: "unknown", role: "member" },
    messages: [],
    joinRequests: [],
    admins: [],
    relayFeedback: {},
    kickVotes: {},
    expelledMembers: [],
    leftMembers: [],
  };
};

const createRandomId = (): string => Math.random().toString(36).slice(2);
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
type RelayEvidenceRuntimeState = Omit<RelayEvidencePolicyParams, "nowMs">;

export const useSealedCommunity = (params: UseSealedCommunityParams): UseSealedCommunityResult => {
  const optionalProfileBus = useOptionalProfileMessageBus();
  const dedupeMemberPubkeys = useCallback((values: ReadonlyArray<PublicKeyHex>): ReadonlyArray<PublicKeyHex> => (
    Array.from(new Set(values))
  ), []);
  const initialHasLocalMembershipEvidence = Boolean(
    params.myPublicKeyHex
    && (params.initialMembers ?? []).includes(params.myPublicKeyHex)
  );
  const [localMembershipEvidence, setLocalMembershipEvidence] = useState<boolean>(initialHasLocalMembershipEvidence);
  const [state, setState] = useState<Nip29GroupState>(() => {
    const base = createInitialState();
    const groupId = params.groupId.trim();
    const relayUrl = params.relayUrl.trim();
    if (!groupId || !relayUrl) {
      return base;
    }
    const cached = loadCommunityTerminalMembershipCache({ groupId, relayUrl });
    if (!cached) {
      return base;
    }
    return {
      ...base,
      leftMembers: cached.leftMemberPubkeys,
      expelledMembers: cached.expelledMemberPubkeys,
      ...(typeof cached.disbandedAtUnixMs === "number" ? { disbandedAt: cached.disbandedAtUnixMs } : {}),
    };
  });
  const [chatPerformanceV2Enabled, setChatPerformanceV2Enabled] = useState<boolean>(() => PrivacySettingsService.getSettings().chatPerformanceV2);
  /** Bumps the relay timeline subscription so manual refresh can pull membership events again. */
  const [membershipResyncEpoch, setMembershipResyncEpoch] = useState(0);
  
  // CRDT-based membership management — stable scope when optional communityId is omitted (tests + legacy callers).
  const crdtCommunityId =
    (typeof params.communityId === "string" && params.communityId.trim().length > 0
      ? params.communityId.trim()
      : null)
    ?? (params.groupId.trim().length > 0 ? params.groupId : null);
  /** Canonical governance scope (contract 26); matches CRDT community id. */
  const governanceScopeId = crdtCommunityId ?? params.groupId.trim();
  const crdt = useCommunityMembershipCRDT(
    crdtCommunityId,
    params.myPublicKeyHex || "",
    params.myPublicKeyHex || "unknown-device"
  );
  const crdtAddMemberRef = useRef(crdt.addMember);
  crdtAddMemberRef.current = crdt.addMember;
  const crdtRemoveMemberRef = useRef(crdt.removeMember);
  crdtRemoveMemberRef.current = crdt.removeMember;
  const crdtRemoveMembersRef = useRef(crdt.removeMembers);
  crdtRemoveMembersRef.current = crdt.removeMembers;
  const members = useMemo(() => crdt.members, [crdt.members]);
  /** Stable primitive — avoids re-running seed effects when parents pass a fresh initialMembers array each render. */
  const compatibilitySeedFingerprint = useMemo(
    () => dedupeMemberPubkeys([
      ...(params.initialMembers ?? []),
      ...(localMembershipEvidence && params.myPublicKeyHex ? [params.myPublicKeyHex] : []),
    ])
      .slice()
      .sort()
      .join(","),
    [dedupeMemberPubkeys, localMembershipEvidence, params.initialMembers, params.myPublicKeyHex],
  );
  const membersSortedFingerprint = useMemo(
    () => [...members].sort().join(","),
    [members],
  );
  const localMembershipEvidenceRef = useRef<boolean>(initialHasLocalMembershipEvidence);
  const membersRef = useRef<ReadonlyArray<PublicKeyHex>>([]);
  const relayEvidenceRef = useRef<RelayEvidenceRuntimeState>({
    subscriptionEstablishedAt: null,
    lastEventReceivedAt: null,
    eoseReceivedAt: null,
    eventCount: 0,
  });
  /** Once steady_state is reached, stay latched until subscription scope resets (avoids leave events resetting quiet-period). */
  const relaySteadyStateLatchedRef = useRef(false);
  const readRelayEvidenceConfidence = useCallback((): RelayEvidenceConfidence => {
    const confidence = resolveRelayEvidenceConfidence({
      ...relayEvidenceRef.current,
      nowMs: Date.now(),
    });
    if (confidence === "steady_state") {
      relaySteadyStateLatchedRef.current = true;
    }
    return confidence;
  }, []);
  const canApplyRelayInferredRemovalNow = useCallback((): boolean => {
    if (relaySteadyStateLatchedRef.current) {
      return true;
    }
    if (canApplyRelayInferredMemberRemoval(readRelayEvidenceConfidence())) {
      return true;
    }
    const evidence = relayEvidenceRef.current;
    if (evidence.subscriptionEstablishedAt === null) {
      return false;
    }
    const elapsedMs = Date.now() - evidence.subscriptionEstablishedAt;
    return elapsedMs >= 10_000 && evidence.eventCount >= 3;
  }, [readRelayEvidenceConfidence]);
  const resolveParticipationPubkeysForTerminal = useCallback((): ReadonlyArray<PublicKeyHex> => (
    resolveCommunityParticipationPubkeys({
      communityMessages: communityMessagesRef.current,
      additionalParticipationPubkeys: dedupeMemberPubkeys([
        ...(params.initialMembers ?? []),
        ...membersRef.current,
        ...(params.myPublicKeyHex && localMembershipEvidenceRef.current ? [params.myPublicKeyHex] : []),
      ]),
    })
  ), [dedupeMemberPubkeys, params.initialMembers, params.myPublicKeyHex]);
  const leftMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(state.leftMembers);
  const communityMessagesRef = useRef<ReadonlyArray<GroupMessageEvent>>(state.messages);
  const expelledMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(state.expelledMembers);
  const disbandedAtRef = useRef<number | undefined>(state.disbandedAt);
  const disbandHandledRef = useRef(false);
  const rejectionLogStateRef = useRef<Record<string, { emitted: number; suppressed: number }>>({});
  const rejectionStatsRef = useRef<{
    totalRejected: number;
    relayScopeMismatch: number;
    lastReason?: string;
    lastReceivedRelay?: string;
  }>({
    totalRejected: 0,
    relayScopeMismatch: 0
  });
  const pendingRealtimeMessagesRef = useRef<Array<Readonly<{ groupMessage: GroupMessageEvent; unifiedMessage: Message }>>>([]);
  /** Coalesce relay-delivered membership ops; sort by sortAt so replay order matches causal time; defer so CRDT init wins races. */
  const deferredMembershipAppliesRef = useRef<Array<Readonly<{ sortAt: number; tieBreak: string; fn: () => void }>>>([]);
  const deferredMembershipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeFlushFrameRef = useRef<number | null>(null);
  const deletedMessageTombstonesRef = useRef<Map<string, number>>(new Map());
  const initialMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(params.initialMembers ?? []);
  const descriptorVersionRef = useRef<number>(1);
  const governanceRef = useRef<CommunityGovernanceReducerState>(createEmptyCommunityGovernanceState());
  const governanceFinalizeInFlightRef = useRef<Set<string>>(new Set());
  const appliedGovernanceProposalIdsRef = useRef<Set<string>>(new Set());
  const governanceSessionLoadedKeyRef = useRef<string | null>(null);
  const governanceSessionWrittenJsonRef = useRef<string | null>(null);
  const governanceHydratedRef = useRef(false);
  const ingestGovernanceEventRef = useRef<(event: GovernanceReducerEvent) => void>(() => { });
  const updateMetadataRef = useRef<(
    metadata: GroupMetadata,
    options?: Readonly<{ governanceProposalId?: string }>,
  ) => Promise<void>>(async () => { });
  const conversationId = useMemo(
    () => toGroupConversationId({ groupId: params.groupId, relayUrl: params.relayUrl, communityId: params.communityId }),
    [params.groupId, params.relayUrl, params.communityId]
  );
  const profileId = getResolvedProfileId();
  const governanceSessionStorageKey = useMemo(
    () => getScopedStorageKey(`obscur_community_governance_v1_${conversationId}`, profileId),
    [conversationId, profileId],
  );
  const joinRequestPendingKey = useMemo(() => {
    if (!params.myPublicKeyHex) return null;
    return toJoinRequestPendingKey({
      relayUrl: params.relayUrl,
      groupId: params.groupId,
      myPublicKeyHex: params.myPublicKeyHex,
      profileId,
    });
  }, [params.groupId, params.myPublicKeyHex, params.relayUrl, profileId]);

  useLayoutEffect(() => {
    if (params.enabled === false || typeof sessionStorage === "undefined") {
      return;
    }
    if (governanceSessionLoadedKeyRef.current === governanceSessionStorageKey) {
      governanceHydratedRef.current = true;
      return;
    }
    governanceSessionLoadedKeyRef.current = governanceSessionStorageKey;
    governanceHydratedRef.current = false;
    const raw = sessionStorage.getItem(governanceSessionStorageKey);
    const restored = parseStoredCommunityGovernanceState(raw);
    if (restored) {
      hydrateCommunityGovernanceState(governanceScopeId, restored);
      governanceRef.current = restored;
      governanceSessionWrittenJsonRef.current = serializeCommunityGovernanceState(restored);
    } else {
      governanceSessionWrittenJsonRef.current = null;
    }
    governanceHydratedRef.current = true;
  }, [governanceScopeId, governanceSessionStorageKey, params.enabled]);

  useEffect(() => {
    if (!governanceHydratedRef.current || params.enabled === false || typeof sessionStorage === "undefined") {
      return;
    }
    const persistGovernanceSession = (): void => {
      const g = getCommunityGovernanceReducerState(governanceScopeId);
      governanceRef.current = g;
      const hasData =
        g.activeProposalIds.length > 0
        || g.resolvedProposalIds.length > 0
        || Object.keys(g.proposalsById).length > 0;
      if (!hasData) {
        governanceSessionWrittenJsonRef.current = null;
        try {
          sessionStorage.removeItem(governanceSessionStorageKey);
        } catch {
          // ignore
        }
        return;
      }
      const json = serializeCommunityGovernanceState(g);
      if (json === governanceSessionWrittenJsonRef.current) {
        return;
      }
      governanceSessionWrittenJsonRef.current = json;
      try {
        sessionStorage.setItem(governanceSessionStorageKey, json);
      } catch {
        // ignore quota / private mode
      }
    };
    persistGovernanceSession();
    return subscribeCommunityGovernance(governanceScopeId, persistGovernanceSession);
  }, [governanceScopeId, governanceSessionStorageKey, params.enabled]);

  useEffect(() => {
    if (initialHasLocalMembershipEvidence) {
      setLocalMembershipEvidence(true);
    }
  }, [initialHasLocalMembershipEvidence]);

  useEffect(() => {
    localMembershipEvidenceRef.current = localMembershipEvidence;
  }, [localMembershipEvidence]);

  useEffect(() => {
    initialMembersRef.current = params.initialMembers ?? [];
  }, [params.initialMembers]);

  useEffect(() => {
    if (!params.groupId || !params.myPublicKeyHex) return;
    let cancelled = false;
    void (async () => {
      try {
        const record = await roomKeyStore.getRoomKeyRecord(params.groupId);
        if (cancelled || !record) return;
        setLocalMembershipEvidence(true);
      } catch {
        // no-op
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.groupId, params.myPublicKeyHex]);

  useEffect(() => {
    const onPrivacySettingsChanged = () => {
      setChatPerformanceV2Enabled(PrivacySettingsService.getSettings().chatPerformanceV2);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("privacy-settings-changed", onPrivacySettingsChanged);
      return () => window.removeEventListener("privacy-settings-changed", onPrivacySettingsChanged);
    }
    return;
  }, []);

  const applyControlEvent = useCallback((event: CommunityControlEvent): void => {
    const myPk = params.myPublicKeyHex;

    if (event.eventFamily === "membership") {
      switch (event.eventType) {
        case "COMMUNITY_MEMBER_JOINED": {
          if (disbandedAtRef.current !== undefined) return;
          crdtAddMemberRef.current(event.subjectPublicKeyHex);
          if (myPk && event.subjectPublicKeyHex === myPk) {
            setState((prev) => ({
              ...prev,
              membership: {
                ...prev.membership,
                status: transitionMembershipStatus(prev.membership.status, { type: "JOIN_SUCCESS" }),
              },
              leftMembers: prev.leftMembers.filter((pk) => pk !== event.subjectPublicKeyHex),
              expelledMembers: prev.expelledMembers.filter((pk) => pk !== event.subjectPublicKeyHex),
            }));
          } else {
            setState((prev) => ({
              ...prev,
              leftMembers: prev.leftMembers.filter((pk) => pk !== event.subjectPublicKeyHex),
              expelledMembers: prev.expelledMembers.filter((pk) => pk !== event.subjectPublicKeyHex),
            }));
          }
          return;
        }
        case "COMMUNITY_MEMBER_LEFT": {
          if (shouldSuppressStaleCommunityMemberRemoval({
            subjectPubkey: event.subjectPublicKeyHex,
            removalAtUnixMs: event.createdAtUnixMs,
            communityMessages: communityMessagesRef.current,
          })) {
            return;
          }
          crdtRemoveMemberRef.current(event.subjectPublicKeyHex);
          setState((prev) => ({
            ...prev,
            leftMembers: prev.leftMembers.includes(event.subjectPublicKeyHex)
              ? prev.leftMembers
              : [...prev.leftMembers, event.subjectPublicKeyHex],
            membership:
              myPk && event.subjectPublicKeyHex === myPk
                ? {
                    ...prev.membership,
                    status: transitionMembershipStatus(prev.membership.status, { type: "LEAVE" }),
                  }
                : prev.membership,
          }));
          return;
        }
        case "COMMUNITY_MEMBER_EXPELLED": {
          if (shouldSuppressStaleCommunityMemberRemoval({
            subjectPubkey: event.subjectPublicKeyHex,
            removalAtUnixMs: event.createdAtUnixMs,
            communityMessages: communityMessagesRef.current,
          })) {
            return;
          }
          crdtRemoveMemberRef.current(event.subjectPublicKeyHex);
          setState((prev) => ({
            ...prev,
            expelledMembers: prev.expelledMembers.includes(event.subjectPublicKeyHex)
              ? prev.expelledMembers
              : [...prev.expelledMembers, event.subjectPublicKeyHex],
            membership:
              myPk && event.subjectPublicKeyHex === myPk
                ? {
                    ...prev.membership,
                    status: transitionMembershipStatus(prev.membership.status, { type: "EXPELLED" }),
                  }
                : prev.membership,
          }));
          return;
        }
        default:
          return;
      }
    }

    if (event.eventFamily === "terminal_lifecycle" && event.eventType === "COMMUNITY_DISBANDED") {
      disbandedAtRef.current = event.createdAtUnixMs;
      crdtRemoveMembersRef.current([...membersRef.current]);
      setState((prev) => (
        prev.disbandedAt === event.createdAtUnixMs
          ? prev
          : { ...prev, disbandedAt: event.createdAtUnixMs }
      ));
    }
  }, [params.myPublicKeyHex, readRelayEvidenceConfidence]);

  const createMembershipControlEventBase = useCallback((paramsForEvent: Readonly<{
    eventType: "COMMUNITY_MEMBER_JOINED" | "COMMUNITY_MEMBER_LEFT" | "COMMUNITY_MEMBER_EXPELLED";
    logicalEventId: string;
    createdAtUnixMs: number;
    subjectPublicKeyHex: PublicKeyHex;
  }>): Extract<
    CommunityControlEvent,
    Readonly<{ eventFamily: "membership" }>
  > => ({
    eventFamily: "membership",
    eventType: paramsForEvent.eventType,
    logicalEventId: paramsForEvent.logicalEventId,
    idempotencyKey: `${paramsForEvent.eventType}:${params.groupId}:${paramsForEvent.logicalEventId}`,
    communityId: params.communityId ?? params.groupId,
    groupId: params.groupId,
    relayScope: normalizeRelayUrl(params.relayUrl),
    actorPublicKeyHex: params.myPublicKeyHex ?? ("unknown" as PublicKeyHex),
    createdAtUnixMs: paramsForEvent.createdAtUnixMs,
    source: "relay_live",
    membershipVersion: 1,
    subjectPublicKeyHex: paramsForEvent.subjectPublicKeyHex,
  }), [params.communityId, params.groupId, params.myPublicKeyHex, params.relayUrl]);

  const createTerminalControlEventBase = useCallback((paramsForEvent: Readonly<{
    logicalEventId: string;
    createdAtUnixMs: number;
  }>): Extract<
    CommunityControlEvent,
    Readonly<{ eventFamily: "terminal_lifecycle"; eventType: "COMMUNITY_DISBANDED" }>
  > => ({
    eventFamily: "terminal_lifecycle",
    eventType: "COMMUNITY_DISBANDED",
    logicalEventId: paramsForEvent.logicalEventId,
    idempotencyKey: `COMMUNITY_DISBANDED:${params.groupId}:${paramsForEvent.logicalEventId}`,
    communityId: params.communityId ?? params.groupId,
    groupId: params.groupId,
    relayScope: normalizeRelayUrl(params.relayUrl),
    actorPublicKeyHex: params.myPublicKeyHex ?? ("unknown" as PublicKeyHex),
    createdAtUnixMs: paramsForEvent.createdAtUnixMs,
    source: "relay_live",
    reasonCode: "disbanded",
  }), [params.communityId, params.groupId, params.myPublicKeyHex, params.relayUrl]);

  const queueDeferredMembershipApply = useCallback((sortAt: number, tieBreak: string, fn: () => void): void => {
    deferredMembershipAppliesRef.current.push({ sortAt, tieBreak, fn });
    if (deferredMembershipTimerRef.current !== null) {
      clearTimeout(deferredMembershipTimerRef.current);
    }
    deferredMembershipTimerRef.current = setTimeout((): void => {
      deferredMembershipTimerRef.current = null;
      const batch = deferredMembershipAppliesRef.current.splice(0);
      batch.sort((a, b) => (
        a.sortAt !== b.sortAt ? a.sortAt - b.sortAt : a.tieBreak.localeCompare(b.tieBreak)
      ));
      batch.forEach((item) => {
        item.fn();
      });
    }, 0);
  }, []);

  useEffect(() => (): void => {
    if (deferredMembershipTimerRef.current !== null) {
      clearTimeout(deferredMembershipTimerRef.current);
      deferredMembershipTimerRef.current = null;
    }
  }, []);

  const flushRealtimeMessages = useCallback((): void => {
    realtimeFlushFrameRef.current = null;
    const queued = pendingRealtimeMessagesRef.current;
    pendingRealtimeMessagesRef.current = [];
    if (queued.length === 0) return;

    const dedupedById = new Map<string, Readonly<{ groupMessage: GroupMessageEvent; unifiedMessage: Message }>>();
    queued.forEach((entry) => {
      dedupedById.set(entry.groupMessage.id, entry);
    });
    const deduped = Array.from(dedupedById.values());
    const nowMs = Date.now();
    const profileId = getResolvedProfileId() || undefined;
    for (const [messageId, deletedAt] of deletedMessageTombstonesRef.current.entries()) {
      if (nowMs - deletedAt > GROUP_DELETE_TOMBSTONE_TTL_MS
        && !isSuppressedCommunityGroupMessageIdentity({ messageId, profileId, nowMs })) {
        deletedMessageTombstonesRef.current.delete(messageId);
      }
    }
    const filtered = deduped.filter((entry) => {
      const messageId = entry.groupMessage.id;
      if (isSuppressedCommunityGroupMessageIdentity({ messageId, profileId, nowMs })) {
        return false;
      }
      const deletedAt = deletedMessageTombstonesRef.current.get(messageId);
      if (typeof deletedAt !== "number") {
        return true;
      }
      return (nowMs - deletedAt) > GROUP_DELETE_TOMBSTONE_TTL_MS;
    });

    filtered.forEach((entry) => {
      messageBus.emitNewMessage(conversationId, entry.unifiedMessage);
    });

    const incomingMessages = filtered.map((entry) => entry.groupMessage);
    setState((prev: Nip29GroupState): Nip29GroupState => {
      const merged = mergeGroupMessagesDescending({
        previous: prev.messages,
        incoming: incomingMessages
      });
      if (merged.length === prev.messages.length && merged.every((message, index) => message.id === prev.messages[index]?.id)) {
        return prev;
      }
      return { ...prev, messages: merged, status: "ready" };
    });

    if (isTauri() && incomingMessages.length > 0) {
      const profileId = getResolvedProfileId();
      const receivedAt = Date.now();
      incomingMessages.forEach((msg) => {
        dbInsertGroupMessage({
          event_id: msg.id,
          group_id: params.groupId,
          profile_id: profileId,
          sender_pubkey: msg.pubkey ?? (params.myPublicKeyHex ?? ""),
          plaintext: msg.content,
          created_at: msg.created_at * 1000,
          received_at: receivedAt,
        }).catch(() => {});
      });
    }
  }, [conversationId, params.groupId, params.myPublicKeyHex]);

  const queueRealtimeMessage = useCallback((entry: Readonly<{ groupMessage: GroupMessageEvent; unifiedMessage: Message }>): void => {
    pendingRealtimeMessagesRef.current.push(entry);

    if (!chatPerformanceV2Enabled) {
      flushRealtimeMessages();
      return;
    }

    if (pendingRealtimeMessagesRef.current.length >= 50) {
      flushRealtimeMessages();
      return;
    }

    if (realtimeFlushFrameRef.current !== null) return;
    realtimeFlushFrameRef.current = requestAnimationFrame(() => {
      flushRealtimeMessages();
    });
  }, [chatPerformanceV2Enabled, flushRealtimeMessages]);

  const logRejectedEvent = useCallback((params: Readonly<{
    reason: string;
    level?: "warn" | "info";
    eventId?: string;
    context?: Record<string, unknown>;
  }>): void => {
    const reason = params.reason;
    const level = params.level ?? "warn";
    const bucket = rejectionLogStateRef.current[reason] ?? { emitted: 0, suppressed: 0 };
    const limit = level === "warn" ? 5 : 10;
    const stats = rejectionStatsRef.current;
    const receivedRelay = typeof params.context?.receivedRelay === "string" ? params.context.receivedRelay : undefined;

    stats.totalRejected += 1;
    if (reason === "relay_scope_mismatch") {
      stats.relayScopeMismatch += 1;
      if (receivedRelay) stats.lastReceivedRelay = receivedRelay;
    }
    incrementAbuseMetric("quarantined_malformed_event");
    if (reason !== "relay_scope_mismatch") {
      recordMalformedEventQuarantinedRisk();
    }
    stats.lastReason = reason;

    const buildNotice = (): string => {
      if (reason === "relay_scope_mismatch") {
        return "Some group events were ignored because they arrived from an unexpected relay.";
      }
      if (reason === "community_binding_mismatch") {
        return "Some group events were ignored due to invalid community binding.";
      }
      if (reason === "decrypt_failed") {
        return "Some group events could not be decrypted with your current room keys.";
      }
      return "Some group events were rejected for safety checks.";
    };

    const publishFeedback = (): void => {
      setState((prev) => ({
        ...prev,
        relayFeedback: {
          ...prev.relayFeedback,
          lastNotice: buildNotice(),
          rejectionStats: {
            totalRejected: stats.totalRejected,
            relayScopeMismatch: stats.relayScopeMismatch,
            lastReason: stats.lastReason,
            lastReceivedRelay: stats.lastReceivedRelay,
            updatedAt: Date.now()
          }
        }
      }));
    };

    if (bucket.emitted < limit) {
      logAppEvent({
        name: "community.event.rejected",
        level,
        scope: { feature: "groups", action: "sealed_receive" },
        context: {
          reason,
          ...(typeof params.eventId === "string" ? { eventId: params.eventId } : {}),
          ...(params.context ?? {})
        }
      });
      bucket.emitted += 1;
      rejectionLogStateRef.current[reason] = bucket;
      if (bucket.emitted === 1) {
        publishFeedback();
      }
      return;
    }

    bucket.suppressed += 1;
    rejectionLogStateRef.current[reason] = bucket;
    if (bucket.suppressed === 1 || bucket.suppressed % 50 === 0) {
      logAppEvent({
        name: "community.event.rejected",
        level: "info",
        scope: { feature: "groups", action: "sealed_receive" },
        context: {
          reason: `${reason}_suppressed`,
          suppressedCount: bucket.suppressed,
          ...(params.context ?? {})
        }
      });
      publishFeedback();
    }
  }, []);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    return () => {
      if (realtimeFlushFrameRef.current !== null) {
        cancelAnimationFrame(realtimeFlushFrameRef.current);
      }
      pendingRealtimeMessagesRef.current = [];
      deletedMessageTombstonesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    leftMembersRef.current = state.leftMembers;
    expelledMembersRef.current = state.expelledMembers;
    disbandedAtRef.current = state.disbandedAt;
    communityMessagesRef.current = state.messages;
  }, [state.leftMembers, state.expelledMembers, state.disbandedAt, state.messages]);

  useEffect(() => {
    if (!params.myPublicKeyHex) return;
    const membershipConfirmed = state.membership.status === "member" || members.includes(params.myPublicKeyHex);
    if (membershipConfirmed) {
      clearJoinRequestPending(joinRequestPendingKey);
      setState((prev) => ({
        ...prev,
        joinRequestState: "accepted",
        joinRequestBlockReason: undefined
      }));
      return;
    }
    if (!joinRequestPendingKey) return;
    const current = getJoinRequestStorageState(joinRequestPendingKey);
    if (current.state === "cooldown" || current.state === "pending" || current.state === "denied" || current.state === "expired") {
      setState((prev) => ({
        ...prev,
        joinRequestState: current.state,
        joinRequestBlockReason: blockReasonFromJoinState(current.state),
      }));
    }
  }, [joinRequestPendingKey, members, params.myPublicKeyHex, state.membership.status]);

  useEffect(() => {
    if (!state.disbandedAt) return;
    if (disbandHandledRef.current) return;
    disbandHandledRef.current = true;
    dispatchGroupRemove(conversationId);
  }, [state.disbandedAt, conversationId]);

  const publishedSnapshotMembers = useMemo<ReadonlyArray<PublicKeyHex>>(() => (
    projectCommunityMemberRoster({
      seededMemberPubkeys: params.initialMembers,
      liveMemberPubkeys: members,
      localMemberPubkey: localMembershipEvidence ? params.myPublicKeyHex : null,
      leftMemberPubkeys: state.leftMembers,
      expelledMemberPubkeys: state.expelledMembers,
    }).activeMemberPubkeys
  ), [
    localMembershipEvidence,
    members,
    params.initialMembers,
    params.myPublicKeyHex,
    state.expelledMembers,
    state.leftMembers,
  ]);

  useEffect(() => {
    if (!params.enabled || state.messages.length === 0) {
      return;
    }
    const filteredTerminal = filterTerminalMembersWithoutParticipationEvidence({
      leftMemberPubkeys: state.leftMembers,
      expelledMemberPubkeys: state.expelledMembers,
      communityMessages: state.messages,
      additionalParticipationPubkeys: resolveParticipationPubkeysForTerminal(),
    });
    const leftUnchanged = filteredTerminal.leftMemberPubkeys.join(",") === state.leftMembers.join(",");
    const expelledUnchanged = filteredTerminal.expelledMemberPubkeys.join(",") === state.expelledMembers.join(",");
    if (leftUnchanged && expelledUnchanged) {
      return;
    }
    setState((prev) => ({
      ...prev,
      leftMembers: filteredTerminal.leftMemberPubkeys as ReadonlyArray<PublicKeyHex>,
      expelledMembers: filteredTerminal.expelledMemberPubkeys as ReadonlyArray<PublicKeyHex>,
    }));
  }, [
    params.enabled,
    resolveParticipationPubkeysForTerminal,
    state.expelledMembers,
    state.leftMembers,
    state.messages,
  ]);

  const observedKnownParticipants = useMemo<ReadonlyArray<PublicKeyHex>>(() => (
    projectCommunityMemberRoster({
      seededMemberPubkeys: params.initialMembers,
      liveMemberPubkeys: members,
      localMemberPubkey: localMembershipEvidence ? params.myPublicKeyHex : null,
    }).allKnownMemberPubkeys
  ), [
    localMembershipEvidence,
    members,
    params.initialMembers,
    params.myPublicKeyHex,
  ]);

  useEffect(() => {
    const normalizedGroupId = params.groupId.trim();
    const normalizedRelayUrl = normalizeRelayUrl(params.relayUrl);
    if (!normalizedGroupId || !normalizedRelayUrl) {
      return;
    }
    return subscribeGroupInviteAcceptedDual((detail) => {
      const acceptedGroupId = detail.groupId?.trim();
      const acceptedMemberPubkey = detail.memberPubkey?.trim();
      if (!acceptedGroupId || !acceptedMemberPubkey || acceptedGroupId !== normalizedGroupId) {
        return;
      }
      const relayHint = detail.relayUrl?.trim();
      if (relayHint && normalizeRelayUrl(relayHint) !== normalizedRelayUrl) {
        return;
      }
      if (detail.communityId?.trim() && params.communityId?.trim() && detail.communityId.trim() !== params.communityId.trim()) {
        return;
      }
      reinstateCommunityMemberTerminalEvidence({
        groupId: normalizedGroupId,
        relayUrl: normalizedRelayUrl,
        memberPubkeys: [acceptedMemberPubkey],
        profileId: getResolvedProfileId(),
      });
      crdtAddMemberRef.current(acceptedMemberPubkey as PublicKeyHex);
      setState((prev) => ({
        ...prev,
        leftMembers: prev.leftMembers.filter((pubkey) => pubkey !== acceptedMemberPubkey),
        expelledMembers: prev.expelledMembers.filter((pubkey) => pubkey !== acceptedMemberPubkey),
      }));
    }, optionalProfileBus);
  }, [optionalProfileBus, params.communityId, params.groupId, params.relayUrl]);

  useEffect(() => {
    const normalizedGroupId = params.groupId.trim();
    const normalizedRelayUrl = normalizeRelayUrl(params.relayUrl);
    if (!normalizedGroupId || !normalizedRelayUrl || state.messages.length === 0) {
      return;
    }
    const participationPubkeys = resolveParticipationPubkeysForTerminal();
    if (participationPubkeys.length === 0) {
      return;
    }
    const profileId = getResolvedProfileId();
    stripTerminalCommunityMembersWithActiveEvidence({
      groupId: normalizedGroupId,
      relayUrl: normalizedRelayUrl,
      relayBackedMemberPubkeys: participationPubkeys,
      conversationAuthorPubkeys: participationPubkeys,
      profileId,
    });
    const reinstateSet = new Set(
      participationPubkeys.map((pk) => pk.trim().toLowerCase()).filter((pk) => pk.length > 0),
    );
    if (reinstateSet.size === 0) {
      return;
    }
    setState((prev) => {
      const nextLeft = prev.leftMembers.filter((pk) => !reinstateSet.has(pk.trim().toLowerCase()));
      const nextExpelled = prev.expelledMembers.filter((pk) => !reinstateSet.has(pk.trim().toLowerCase()));
      if (nextLeft.length === prev.leftMembers.length && nextExpelled.length === prev.expelledMembers.length) {
        return prev;
      }
      return {
        ...prev,
        leftMembers: nextLeft,
        expelledMembers: nextExpelled,
      };
    });
  }, [params.groupId, params.relayUrl, publishedSnapshotMembers, resolveParticipationPubkeysForTerminal, state.messages]);

  const lastMembershipSnapshotFingerprintRef = useRef("");
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const fingerprint = [
      publishedSnapshotMembers.slice().sort().join(","),
      state.leftMembers.slice().sort().join(","),
      state.expelledMembers.slice().sort().join(","),
      String(state.disbandedAt ?? ""),
    ].join("|");
    if (fingerprint === lastMembershipSnapshotFingerprintRef.current) {
      return;
    }
    lastMembershipSnapshotFingerprintRef.current = fingerprint;
    const filteredTerminal = filterTerminalMembersWithoutParticipationEvidence({
      leftMemberPubkeys: state.leftMembers,
      expelledMemberPubkeys: state.expelledMembers,
      communityMessages: communityMessagesRef.current,
      additionalParticipationPubkeys: resolveParticipationPubkeysForTerminal(),
    });
    const detail = {
      groupId: params.groupId,
      relayUrl: normalizeRelayUrl(params.relayUrl),
      communityId: params.communityId,
      activeMemberPubkeys: publishedSnapshotMembers,
      leftMembers: filteredTerminal.leftMemberPubkeys,
      expelledMembers: filteredTerminal.expelledMemberPubkeys,
      disbandedAt: state.disbandedAt ?? null,
    };
    queueMicrotask(() => {
      dispatchGroupMembershipSnapshot(detail);
    });
  }, [params.communityId, params.groupId, params.relayUrl, publishedSnapshotMembers, resolveParticipationPubkeysForTerminal, state.disbandedAt, state.expelledMembers, state.leftMembers]);

  const lastKnownParticipantsFingerprintRef = useRef("");
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (observedKnownParticipants.length === 0) {
      return;
    }
    const fingerprint = observedKnownParticipants.slice().sort().join(",");
    if (fingerprint === lastKnownParticipantsFingerprintRef.current) {
      return;
    }
    lastKnownParticipantsFingerprintRef.current = fingerprint;
    const detail = {
      groupId: params.groupId,
      relayUrl: normalizeRelayUrl(params.relayUrl),
      communityId: params.communityId,
      conversationId,
      participantPubkeys: observedKnownParticipants,
    };
    queueMicrotask(() => {
      dispatchCommunityKnownParticipantsObserved(detail);
    });
  }, [conversationId, observedKnownParticipants, params.communityId, params.groupId, params.relayUrl]);

  const localBootstrapAppliedRef = useRef(false);
  useEffect(() => {
    if (!params.myPublicKeyHex || !localMembershipEvidence) return;
    if (crdt.isLoading) return;
    if (disbandedAtRef.current !== undefined) return;
    if (leftMembersRef.current.includes(params.myPublicKeyHex)) return;
    if (expelledMembersRef.current.includes(params.myPublicKeyHex)) return;
    if (membersRef.current.includes(params.myPublicKeyHex)) {
      localBootstrapAppliedRef.current = true;
      return;
    }
    if (localBootstrapAppliedRef.current) return;
    localBootstrapAppliedRef.current = true;
    applyControlEvent(createMembershipControlEventBase({
      eventType: "COMMUNITY_MEMBER_JOINED",
      logicalEventId: `local-bootstrap:${params.myPublicKeyHex}`,
      createdAtUnixMs: 0,
      subjectPublicKeyHex: params.myPublicKeyHex,
    }));
  }, [applyControlEvent, createMembershipControlEventBase, crdt.isLoading, localMembershipEvidence, params.myPublicKeyHex]);

  useEffect(() => {
    localBootstrapAppliedRef.current = false;
  }, [params.groupId, params.relayUrl, params.myPublicKeyHex]);

  // LEDGER-BASED INITIALIZATION DELETED - CRDT handles initialization
  useEffect(() => {
    // CRDT hook handles initialization automatically
    disbandHandledRef.current = false;
    // Relay delete hints are short-lived; durable delete-for-me is enforced via
    // message-delete-tombstone-store on ingest (see community-group-message-suppression).
    deletedMessageTombstonesRef.current.clear();
  }, [params.groupId, params.relayUrl, params.myPublicKeyHex]);

  useEffect(() => {
    if (crdt.isLoading) return;
    const compatibilitySeedMembers = dedupeMemberPubkeys([
      ...(params.initialMembers ?? []),
      ...(localMembershipEvidence && params.myPublicKeyHex ? [params.myPublicKeyHex] : []),
    ]);
    if (compatibilitySeedMembers.length === 0) return;
    if (disbandedAtRef.current !== undefined) return;

    // Use live CRDT members — membersRef can lag a paint behind applyControlEvent and would re-trigger
    // seeding when initialMembers is an inline array with a new reference every parent render.
    const activeMembers = members;
    const isBootSeedOnlyState = (
      activeMembers.length === 0
      || (
        !!params.myPublicKeyHex
        && activeMembers.length === 1
        && activeMembers[0] === params.myPublicKeyHex
      )
    );
    if (!isBootSeedOnlyState) {
      return;
    }

    const terminalExcluded = new Set([
      ...state.leftMembers,
      ...state.expelledMembers,
      ...leftMembersRef.current,
      ...expelledMembersRef.current,
    ].map((pubkey) => pubkey.trim().toLowerCase()));
    const nextMissingMembers = compatibilitySeedMembers.filter((pubkey) => (
      !activeMembers.includes(pubkey)
      && !terminalExcluded.has(pubkey.trim().toLowerCase())
    ));
    if (nextMissingMembers.length === 0) {
      return;
    }

    nextMissingMembers.forEach((pubkey) => {
      applyControlEvent(createMembershipControlEventBase({
        eventType: "COMMUNITY_MEMBER_JOINED",
        logicalEventId: `compat-seed:${pubkey}`,
        createdAtUnixMs: 0,
        subjectPublicKeyHex: pubkey,
      }));
    });
  }, [
    applyControlEvent,
    compatibilitySeedFingerprint,
    createMembershipControlEventBase,
    crdt.isLoading,
    dedupeMemberPubkeys,
    localMembershipEvidence,
    membersSortedFingerprint,
    params.myPublicKeyHex,
    state.expelledMembers,
    state.leftMembers,
  ]);

  useEffect(() => {
    lastMembershipSnapshotFingerprintRef.current = "";
    lastKnownParticipantsFingerprintRef.current = "";
  }, [params.groupId, params.relayUrl, params.myPublicKeyHex]);

  useEffect(() => {
    if (!params.groupId.trim() || !params.relayUrl.trim() || params.enabled === false) {
      return;
    }
    if (!canApplyRelayInferredRemovalNow()) {
      return;
    }
    const filteredTerminal = filterTerminalMembersWithoutParticipationEvidence({
      leftMemberPubkeys: state.leftMembers,
      expelledMemberPubkeys: state.expelledMembers,
      communityMessages: communityMessagesRef.current,
      additionalParticipationPubkeys: resolveParticipationPubkeysForTerminal(),
    });
    saveCommunityTerminalMembershipCache({
      groupId: params.groupId,
      relayUrl: params.relayUrl,
      leftMemberPubkeys: filteredTerminal.leftMemberPubkeys,
      expelledMemberPubkeys: filteredTerminal.expelledMemberPubkeys,
      disbandedAtUnixMs: state.disbandedAt ?? null,
    });
  }, [
    params.enabled,
    params.groupId,
    params.relayUrl,
    publishedSnapshotMembers,
    state.disbandedAt,
    state.expelledMembers,
    state.leftMembers,
    state.messages,
    canApplyRelayInferredRemovalNow,
    resolveParticipationPubkeysForTerminal,
  ]);

  useEffect(() => {
    if (params.enabled === false || !params.groupId.trim() || !params.relayUrl.trim()) {
      return;
    }
    relaySteadyStateLatchedRef.current = false;
    const intervalId = setInterval((): void => {
      if (canApplyRelayInferredMemberRemoval(readRelayEvidenceConfidence())) {
        relaySteadyStateLatchedRef.current = true;
      }
    }, 1000);
    return (): void => {
      clearInterval(intervalId);
    };
  }, [
    params.enabled,
    params.groupId,
    params.relayUrl,
    membershipResyncEpoch,
    readRelayEvidenceConfidence,
  ]);

  useLayoutEffect(() => {
    const normalizedGroupId = params.groupId.trim();
    const normalizedRelayUrl = normalizeRelayUrl(params.relayUrl);
    if (!normalizedGroupId || !normalizedRelayUrl || compatibilitySeedFingerprint.length === 0) {
      return;
    }
    const seedPubkeys = compatibilitySeedFingerprint.split(",").filter((pk) => pk.length > 0) as ReadonlyArray<PublicKeyHex>;
    reinstateCommunityMemberTerminalEvidence({
      groupId: normalizedGroupId,
      relayUrl: normalizedRelayUrl,
      memberPubkeys: seedPubkeys,
      profileId: getResolvedProfileId(),
    });
    const reinstateSet = new Set(seedPubkeys.map((pk) => pk.trim().toLowerCase()));
    setState((prev) => {
      const nextLeft = prev.leftMembers.filter((pk) => !reinstateSet.has(pk.trim().toLowerCase()));
      const nextExpelled = prev.expelledMembers.filter((pk) => !reinstateSet.has(pk.trim().toLowerCase()));
      if (nextLeft.length === prev.leftMembers.length && nextExpelled.length === prev.expelledMembers.length) {
        return prev;
      }
      return { ...prev, leftMembers: nextLeft, expelledMembers: nextExpelled };
    });
  }, [compatibilitySeedFingerprint, params.groupId, params.relayUrl]);

  const poolRef = useRef(params.pool);
  poolRef.current = params.pool;
  const applyControlEventRef = useRef(applyControlEvent);
  applyControlEventRef.current = applyControlEvent;
  const createMembershipControlEventBaseRef = useRef(createMembershipControlEventBase);
  createMembershipControlEventBaseRef.current = createMembershipControlEventBase;
  const createTerminalControlEventBaseRef = useRef(createTerminalControlEventBase);
  createTerminalControlEventBaseRef.current = createTerminalControlEventBase;
  const queueDeferredMembershipApplyRef = useRef(queueDeferredMembershipApply);
  queueDeferredMembershipApplyRef.current = queueDeferredMembershipApply;
  const queueRealtimeMessageRef = useRef(queueRealtimeMessage);
  queueRealtimeMessageRef.current = queueRealtimeMessage;
  const logRejectedEventRef = useRef(logRejectedEvent);
  logRejectedEventRef.current = logRejectedEvent;

  useEffect((): (() => void) => {
    if (!params.groupId || params.enabled === false) {
      return (): void => { };
    }
    const scopedRelayUrl = toScopedRelayUrl(params.relayUrl);
    const applyControlEvent = (event: CommunityControlEvent): void => {
      applyControlEventRef.current(event);
    };
    const createMembershipControlEventBase = (
      paramsForEvent: Parameters<typeof createMembershipControlEventBaseRef.current>[0],
    ): ReturnType<typeof createMembershipControlEventBaseRef.current> => (
      createMembershipControlEventBaseRef.current(paramsForEvent)
    );
    const createTerminalControlEventBase = (
      paramsForEvent: Parameters<typeof createTerminalControlEventBaseRef.current>[0],
    ): ReturnType<typeof createTerminalControlEventBaseRef.current> => (
      createTerminalControlEventBaseRef.current(paramsForEvent)
    );
    const queueDeferredMembershipApply = (
      sortAt: number,
      tieBreak: string,
      fn: () => void,
    ): void => {
      queueDeferredMembershipApplyRef.current(sortAt, tieBreak, fn);
    };
    const queueRealtimeMessage = (
      entry: Parameters<typeof queueRealtimeMessageRef.current>[0],
    ): void => {
      queueRealtimeMessageRef.current(entry);
    };
    const logRejectedEvent = (
      rejected: Parameters<typeof logRejectedEventRef.current>[0],
    ): void => {
      logRejectedEventRef.current(rejected);
    };

    // Connection load only. Membership must be derived from explicit lifecycle events.
    setState(prev => {
      const nextConn = transitionCommunityConnection(prev.status, { type: "START_LOAD" });
      return { ...prev, status: nextConn };
    });

    const onEvent = async (event: NostrEvent, url: string): Promise<void> => {
      // Update relay evidence tracking on every event
      const existingEvidence = relayEvidenceRef.current;
      relayEvidenceRef.current = {
        subscriptionEstablishedAt: existingEvidence?.subscriptionEstablishedAt ?? Date.now(),
        lastEventReceivedAt: Date.now(),
        eoseReceivedAt: existingEvidence?.eoseReceivedAt ?? null,
        eventCount: (existingEvidence?.eventCount ?? 0) + 1,
      };

      if (scopedRelayUrl && !isScopedRelayEvent({ scopedRelayUrl, eventRelayUrl: url })) {
        logRejectedEvent({
          reason: "relay_scope_mismatch",
          context: { scopedRelayUrl, eventRelayUrl: url, groupId: params.groupId }
        });
        return;
      }
      if (!hasCommunityBindingTag({ event, groupId: params.groupId })) {
        logRejectedEvent({
          reason: "community_binding_mismatch",
          eventId: event.id,
          context: {
            groupId: params.groupId
          }
        });
        return;
      }

      if (event.kind === GROUP_KIND_SEALED) {
        try {
          const record = await roomKeyStore.getRoomKeyRecord(params.groupId);
          if (!record) return;

          let decryptedPayload: string | undefined;
          const encryptedData = JSON.parse(event.content);

          // Try current key first
          try {
            decryptedPayload = await cryptoService.decryptGroupMessage(encryptedData, record.roomKeyHex);
          } catch (e) {
            // Try previous keys if current key fails
            if (record.previousKeys) {
              for (const oldKey of record.previousKeys) {
                try {
                  decryptedPayload = await cryptoService.decryptGroupMessage(encryptedData, oldKey);
                  break;
                } catch { continue; }
              }
            }
          }

          if (!decryptedPayload) {
            console.warn("Could not decrypt sealed message with any known key");
            logRejectedEvent({
              reason: "decrypt_failed",
              eventId: event.id
            });
            return;
          }

          const innerPayload = JSON.parse(decryptedPayload);
          const actor = event.pubkey as PublicKeyHex;

          if (typeof innerPayload.pubkey === "string" && innerPayload.pubkey !== actor) {
            console.warn("Ignoring sealed event with actor mismatch", { eventId: event.id });
            logRejectedEvent({
              reason: "actor_mismatch",
              eventId: event.id
            });
            return;
          }

          if (disbandedAtRef.current !== undefined && innerPayload.type !== "disband") {
            logRejectedEvent({
              reason: "disbanded_terminal_state",
              level: "info",
              eventId: event.id
            });
            return;
          }

          if (innerPayload.type === "disband") {
            const ts = innerPayload.created_at || event.created_at;
            queueDeferredMembershipApply(ts, `disband:${event.id}`, () => {
              applyControlEvent(createTerminalControlEventBase({
                logicalEventId: event.id,
                createdAtUnixMs: ts,
              }));
            });
            return;
          }

          if (innerPayload.type === "community.created") {
            const ts = innerPayload.created_at || event.created_at;
            if (innerPayload.metadata && typeof innerPayload.metadata === "object") {
              const createdVersion = typeof innerPayload.descriptorVersion === "number"
                ? innerPayload.descriptorVersion
                : 1;
              descriptorVersionRef.current = Math.max(descriptorVersionRef.current, createdVersion);
              const mergedName = pickPreferredCommunityDisplayName(
                typeof innerPayload.metadata.name === "string" ? innerPayload.metadata.name : undefined,
                params.groupId,
                { groupId: params.groupId, communityId: params.communityId },
              );
              setState((prev) => ({
                ...prev,
                metadata: {
                  id: params.groupId,
                  name: mergedName,
                  about: typeof innerPayload.metadata.about === "string" ? innerPayload.metadata.about : prev.metadata?.about,
                  picture: typeof innerPayload.metadata.picture === "string" ? innerPayload.metadata.picture : prev.metadata?.picture,
                  access: (innerPayload.metadata.access === "open" || innerPayload.metadata.access === "invite-only" || innerPayload.metadata.access === "discoverable")
                    ? innerPayload.metadata.access
                    : (prev.metadata?.access ?? "invite-only"),
                  communityMode: innerPayload.metadata.communityMode === "managed_workspace" || innerPayload.metadata.communityMode === "sovereign_room"
                    ? innerPayload.metadata.communityMode
                    : prev.metadata?.communityMode,
                  relayCapabilityTier:
                    innerPayload.metadata.relayCapabilityTier === "unconfigured"
                    || innerPayload.metadata.relayCapabilityTier === "public_default"
                    || innerPayload.metadata.relayCapabilityTier === "trusted_private"
                    || innerPayload.metadata.relayCapabilityTier === "managed_intranet"
                      ? innerPayload.metadata.relayCapabilityTier
                      : prev.metadata?.relayCapabilityTier,
                  descriptorVersion: createdVersion,
                }
              }));
            }
            queueDeferredMembershipApply(ts, `created-join:${event.id}`, () => {
              applyControlEvent(createMembershipControlEventBase({
                eventType: "COMMUNITY_MEMBER_JOINED",
                logicalEventId: event.id,
                createdAtUnixMs: ts,
                subjectPublicKeyHex: actor,
              }));
            });
            return;
          }

          if (innerPayload.type === "community.descriptor_updated") {
            const ts = innerPayload.created_at || event.created_at;
            const incomingVersion = typeof innerPayload.descriptorVersion === "number"
              ? innerPayload.descriptorVersion
              : descriptorVersionRef.current + 1;
            if (incomingVersion < descriptorVersionRef.current) {
              return;
            }
            descriptorVersionRef.current = incomingVersion;
            const incomingMeta = innerPayload.metadata && typeof innerPayload.metadata === "object"
              ? innerPayload.metadata
              : {};
            let mergedMetadata: GroupMetadata | undefined;
            setState((prev) => {
              const name = pickPreferredCommunityDisplayName(
                typeof incomingMeta.name === "string" ? incomingMeta.name : undefined,
                prev.metadata?.name,
                { groupId: params.groupId, communityId: params.communityId },
              );
              const access = (incomingMeta.access === "open"
                || incomingMeta.access === "invite-only"
                || incomingMeta.access === "discoverable")
                ? incomingMeta.access
                : (prev.metadata?.access ?? "invite-only");
              mergedMetadata = {
                id: params.groupId,
                name,
                about: typeof incomingMeta.about === "string" ? incomingMeta.about : prev.metadata?.about,
                picture: typeof incomingMeta.picture === "string" ? incomingMeta.picture : prev.metadata?.picture,
                access,
                communityMode: incomingMeta.communityMode === "managed_workspace" || incomingMeta.communityMode === "sovereign_room"
                  ? incomingMeta.communityMode
                  : prev.metadata?.communityMode,
                relayCapabilityTier:
                  incomingMeta.relayCapabilityTier === "unconfigured"
                  || incomingMeta.relayCapabilityTier === "public_default"
                  || incomingMeta.relayCapabilityTier === "trusted_private"
                  || incomingMeta.relayCapabilityTier === "managed_intranet"
                    ? incomingMeta.relayCapabilityTier
                    : prev.metadata?.relayCapabilityTier,
                descriptorVersion: incomingVersion,
              };
              return { ...prev, metadata: mergedMetadata };
            });
            if (mergedMetadata) {
              const descriptorDetail = {
                groupId: params.groupId,
                relayUrl: params.relayUrl,
                communityId: params.communityId,
                displayName: mergedMetadata.name,
                about: mergedMetadata.about,
                avatar: mergedMetadata.picture,
                access: mergedMetadata.access,
                descriptorVersion: incomingVersion,
                lastEvidenceEventId: event.id,
                publicKeyHex: actor,
              };
              queueMicrotask(() => {
                dispatchGroupDescriptorUpdated(descriptorDetail);
              });
            }
            return;
          }

          if (
            innerPayload.type === "governance.proposed"
            || innerPayload.type === "governance.vote"
            || innerPayload.type === "governance.resolved"
          ) {
            const reducerEvent = toGovernanceReducerEventFromSealed(
              innerPayload as Record<string, unknown>,
              event.id,
              actor,
            );
            if (reducerEvent) {
              ingestGovernanceEventRef.current(reducerEvent);
            }
            return;
          }

          // Consensus Moderation: Handle Votes
          if (innerPayload.type === "vote-kick") {
            const target = innerPayload.target as PublicKeyHex;
            const voter = actor;
            let shouldExpel = false;

            setState(prev => {
              const currentVotes = { ...prev.kickVotes };
              const targetVotes = [...(currentVotes[target] || [])];
              if (!targetVotes.includes(voter)) {
                targetVotes.push(voter);
              }
              currentVotes[target] = targetVotes;

              // Expulsion Logic: > 50% threshold, minimum 2 votes required
              const memberCount = membersRef.current.length;
              const threshold = memberCount > 0 ? Math.floor(memberCount / 2) : Infinity;
              shouldExpel = targetVotes.length >= 2 && targetVotes.length > threshold && !prev.expelledMembers.includes(target);

              return { ...prev, kickVotes: currentVotes };
            });
            if (shouldExpel) {
              queueDeferredMembershipApply(event.created_at, `expel:${event.id}:${target}`, () => {
                applyControlEvent(createMembershipControlEventBase({
                  eventType: "COMMUNITY_MEMBER_EXPELLED",
                  logicalEventId: event.id,
                  createdAtUnixMs: event.created_at,
                  subjectPublicKeyHex: target,
                }));
                toast.error(`Consensus reached: Member ${target.slice(0, 8)}... has been expelled.`);
              });
            }
            return;
          }

          // Handle explicit leaving
          if (innerPayload.type === "leave") {
            const leaver = actor;
            const ts = innerPayload.created_at || event.created_at;
            if (!shouldSuppressStaleCommunityMemberRemoval({
              subjectPubkey: leaver,
              removalAtUnixMs: ts,
              communityMessages: communityMessagesRef.current,
            }) && canApplyRelayInferredRemovalNow()) {
              queueDeferredMembershipApply(ts, `leave:${event.id}`, () => {
                applyControlEvent(createMembershipControlEventBase({
                  eventType: "COMMUNITY_MEMBER_LEFT",
                  logicalEventId: event.id,
                  createdAtUnixMs: ts,
                  subjectPublicKeyHex: leaver,
                }));
              });
            }
            return;
          }

          // Stealth membership ping (control plane only — no chat line)
          if (innerPayload.type === "membership_restate") {
            const member = actor;
            const ts = innerPayload.created_at || event.created_at;
            queueDeferredMembershipApply(ts, `restate:${event.id}`, () => {
              applyControlEvent(createMembershipControlEventBase({
                eventType: "COMMUNITY_MEMBER_JOINED",
                logicalEventId: `restate:${event.id}`,
                createdAtUnixMs: ts,
                subjectPublicKeyHex: member,
              }));
            });
            return;
          }

          // Handle explicit joining (from NIP-17 invites)
          if (innerPayload.type === "join") {
            const joiner = actor;
            const ts = innerPayload.created_at || event.created_at;
            queueDeferredMembershipApply(ts, `join:${event.id}`, () => {
              applyControlEvent(createMembershipControlEventBase({
                eventType: "COMMUNITY_MEMBER_JOINED",
                logicalEventId: event.id,
                createdAtUnixMs: ts,
                subjectPublicKeyHex: joiner,
              }));
            });
            return;
          }

          // Anti-Injection: Filter messages from expelled/left members
          // Use refs (not state) to avoid stale closure inside the async onEvent callback
          if (
            expelledMembersRef.current.includes(actor) ||
            leftMembersRef.current.includes(actor)
          ) {
            console.info(`Filtering message from expelled/left member: ${actor}`);
            return;
          }

          if (isSuppressedCommunityGroupMessageIdentity({
            messageId: event.id,
            eventId: event.id,
          })) {
            return;
          }

          const nextMsg: GroupMessageEvent = {
            id: event.id,
            pubkey: actor,
            created_at: innerPayload.created_at || event.created_at,
            content: innerPayload.content
          };

          const author = nextMsg.pubkey as PublicKeyHex;

          // Emit to MessageBus for localized listeners
          const unifiedMsg: Message = {
            id: event.id,
            kind: 'user',
            content: innerPayload.content,
            timestamp: new Date(nextMsg.created_at * 1000),
            isOutgoing: (author === params.myPublicKeyHex),
            status: 'delivered',
            senderPubkey: author,
            conversationId
          };
          queueRealtimeMessage({ groupMessage: nextMsg, unifiedMessage: unifiedMsg });
        } catch (e) {
          logRejectedEvent({
            reason: "sealed_process_failed",
            eventId: event.id,
            context: { error: e instanceof Error ? e.message : String(e) }
          });
        }
        return;
      }

      if (event.kind === GROUP_KIND_DELETE) {
        const deletedIds = event.tags.filter(t => t[0] === 'e').map(t => t[1]);
        if (deletedIds.length > 0) {
          const nowMs = Date.now();
          deletedIds.forEach((id) => {
            deletedMessageTombstonesRef.current.set(id, nowMs);
            // Canonical chat rendering is MessageBus-backed (useConversationMessages).
            // Emit delete events so all subscribers (including cross-device receivers) converge.
            messageBus.emitMessageDeleted(conversationId, id);
          });
          if (isTauri()) {
            const profileId = getResolvedProfileId();
            const deletedAtMs = nowMs;
            deletedIds.forEach((id) => {
              dbInsertGroupTombstone({
                event_id: id,
                profile_id: profileId,
                deleted_at: deletedAtMs,
                deleted_by: event.pubkey ?? "",
              }).catch(() => {});
            });
          }
          setState((prev: Nip29GroupState): Nip29GroupState => ({
            ...prev,
            messages: prev.messages.filter((m) => !deletedIds.includes(m.id)),
          }));
        }
        return;
      }

      if (event.kind === GROUP_KIND_METADATA) {
        try {
          const metadata = JSON.parse(event.content) as Partial<GroupMetadata>;
          let descriptorDetail: Parameters<typeof dispatchGroupDescriptorUpdated>[0] | undefined;
          setState((prev) => {
            const name = pickPreferredCommunityDisplayName(
              typeof metadata.name === "string" ? metadata.name : undefined,
              prev.metadata?.name,
              { groupId: params.groupId, communityId: params.communityId },
            );
            const incomingVersion = typeof metadata.descriptorVersion === "number"
              ? metadata.descriptorVersion
              : descriptorVersionRef.current;
            if (incomingVersion < descriptorVersionRef.current) {
              return prev;
            }
            descriptorVersionRef.current = Math.max(descriptorVersionRef.current, incomingVersion);
            const nextMetadata: GroupMetadata = {
              id: params.groupId,
              name,
              about: typeof metadata.about === "string" ? metadata.about : prev.metadata?.about,
              picture: typeof metadata.picture === "string" ? metadata.picture : prev.metadata?.picture,
              access: (metadata.access === "open" || metadata.access === "invite-only" || metadata.access === "discoverable")
                ? metadata.access
                : (prev.metadata?.access ?? "invite-only"),
              communityMode: metadata.communityMode === "managed_workspace" || metadata.communityMode === "sovereign_room"
                ? metadata.communityMode
                : prev.metadata?.communityMode,
              relayCapabilityTier:
                metadata.relayCapabilityTier === "unconfigured"
                || metadata.relayCapabilityTier === "public_default"
                || metadata.relayCapabilityTier === "trusted_private"
                || metadata.relayCapabilityTier === "managed_intranet"
                  ? metadata.relayCapabilityTier
                  : prev.metadata?.relayCapabilityTier,
              descriptorVersion: descriptorVersionRef.current,
            };
            descriptorDetail = {
              groupId: params.groupId,
              relayUrl: params.relayUrl,
              communityId: params.communityId,
              displayName: nextMetadata.name,
              about: nextMetadata.about,
              avatar: nextMetadata.picture,
              access: nextMetadata.access,
              descriptorVersion: descriptorVersionRef.current,
              lastEvidenceEventId: event.id,
              publicKeyHex: event.pubkey,
            };
            return { ...prev, metadata: nextMetadata };
          });
          if (descriptorDetail) {
            const detail = descriptorDetail;
            queueMicrotask(() => {
              dispatchGroupDescriptorUpdated(detail);
            });
          }
        } catch {
          // ignore invalid metadata JSON
        }
        return;
      }

      const relayMembership = classifyRelayMembershipEvent(event, params.groupId);
      if (relayMembership) {
        if (relayMembership.kind === "obscur_gossip_delta") {
          return;
        }
        if (relayMembership.kind === "relay_join" && relayMembership.subjectPubkey) {
          const joinTimestamp = relayMembership.createdAtUnixMs;
          queueDeferredMembershipApply(joinTimestamp, `relay-join:${event.id}`, () => {
            applyControlEvent(createMembershipControlEventBase({
              eventType: "COMMUNITY_MEMBER_JOINED",
              logicalEventId: relayMembership.logicalEventId,
              createdAtUnixMs: joinTimestamp,
              subjectPublicKeyHex: relayMembership.subjectPubkey!,
            }));
          });
          return;
        }
        if (relayMembership.kind === "relay_leave" && relayMembership.subjectPubkey) {
          const leavingPubkey = relayMembership.subjectPubkey;
          const leaveTimestamp = relayMembership.createdAtUnixMs;
          if (!shouldSuppressStaleCommunityMemberRemoval({
            subjectPubkey: leavingPubkey,
            removalAtUnixMs: leaveTimestamp,
            communityMessages: communityMessagesRef.current,
          }) && canApplyRelayInferredRemovalNow()) {
            queueDeferredMembershipApply(leaveTimestamp, `relay-leave:${event.id}`, () => {
              applyControlEvent(createMembershipControlEventBase({
                eventType: "COMMUNITY_MEMBER_LEFT",
                logicalEventId: relayMembership.logicalEventId,
                createdAtUnixMs: leaveTimestamp,
                subjectPublicKeyHex: leavingPubkey,
              }));
            });
          }
          return;
        }
        if (relayMembership.kind === "roster_seed" && relayMembership.rosterMemberPubkeys) {
          const rosterMembers = [...relayMembership.rosterMemberPubkeys].filter(
            (pk) => !leftMembersRef.current.includes(pk) && !expelledMembersRef.current.includes(pk),
          );
          if (
            localMembershipEvidenceRef.current
            && params.myPublicKeyHex
            && !rosterMembers.includes(params.myPublicKeyHex)
          ) {
            rosterMembers.push(params.myPublicKeyHex);
          }
          const rosterTimestamp = relayMembership.createdAtUnixMs;
          rosterMembers.forEach((pubkey) => {
            queueDeferredMembershipApply(rosterTimestamp, `${event.id}:roster:${pubkey}`, () => {
              applyControlEvent(createMembershipControlEventBase({
                eventType: "COMMUNITY_MEMBER_JOINED",
                logicalEventId: `${event.id}:roster-seed:${pubkey}`,
                createdAtUnixMs: rosterTimestamp,
                subjectPublicKeyHex: pubkey,
              }));
            });
          });
          const currentVisibleMembers = Array.from(new Set([
            ...membersRef.current,
            ...(params.initialMembers ?? []),
            ...(params.myPublicKeyHex && localMembershipEvidenceRef.current ? [params.myPublicKeyHex] : []),
          ]));
          const omittedMembers = currentVisibleMembers.filter((pubkey) => !rosterMembers.includes(pubkey));
          if (omittedMembers.length > 0) {
            logAppEvent({
              name: "groups.membership_roster_seed_result",
              level: "warn",
              scope: { feature: "groups", action: "membership_roster_seed" },
              context: {
                groupId: params.groupId,
                relayUrl: normalizeRelayUrl(params.relayUrl),
                communityId: params.communityId ?? null,
                reasonCode: "missing_removal_evidence",
                currentMemberCount: currentVisibleMembers.length,
                incomingMemberCount: rosterMembers.length,
                omittedMemberCount: omittedMembers.length,
              },
            });
          }
          return;
        }
      }
    };

    // Initialize relay evidence tracking when subscription is established
    const nowMs = Date.now();
    const existingEvidence = relayEvidenceRef.current;
    relayEvidenceRef.current = {
      subscriptionEstablishedAt: existingEvidence?.subscriptionEstablishedAt ?? nowMs,
      lastEventReceivedAt: existingEvidence?.lastEventReceivedAt ?? nowMs,
      eoseReceivedAt: existingEvidence?.eoseReceivedAt ?? null,
      eventCount: existingEvidence?.eventCount ?? 0,
    };

    const timelineSubId = poolRef.current.subscribe([{
      kinds: [
        GROUP_KIND_SEALED,
        GROUP_KIND_DELETE,
        GROUP_KIND_METADATA,
        GROUP_KIND_MEMBERS,
        GROUP_KIND_REQUEST_JOIN,
        GROUP_KIND_LEAVE,
        RELAY_KIND_MEMBERSHIP_SIGNAL,
      ],
      "#h": [params.groupId],
      limit: 100
    }], onEvent);

    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "ready" }));
    });

    return (): void => {
      poolRef.current.unsubscribe(timelineSubId);
    };
  }, [
    params.groupId,
    params.relayUrl,
    params.enabled,
    conversationId,
    membershipResyncEpoch,
  ]);

  const refresh = useCallback((): void => {
    setMembershipResyncEpoch((n) => n + 1);
  }, []);

  const clearLocalTerminalMembershipEvidence = useCallback((): void => {
    if (!params.groupId.trim() || !params.relayUrl.trim()) {
      return;
    }
    saveCommunityTerminalMembershipCache({
      groupId: params.groupId,
      relayUrl: params.relayUrl,
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      disbandedAtUnixMs: state.disbandedAt ?? null,
    });
    leftMembersRef.current = [];
    expelledMembersRef.current = [];
    setState((prev) => ({
      ...prev,
      leftMembers: [],
      expelledMembers: [],
    }));
  }, [params.groupId, params.relayUrl, state.disbandedAt]);

  const publishToCommunityScope = useCallback(async (event: NostrEvent): Promise<MultiRelayPublishResult> => {
    const payload = JSON.stringify(["EVENT", event]);
    const primary = toScopedRelayUrl(params.relayUrl);
    const extras = (params.communityRelayBroadcastUrls ?? [])
      .map((url) => toScopedRelayUrl(url))
      .filter((url): url is string => Boolean(url));
    const targetUrls = Array.from(new Set([
      ...(primary ? [primary] : []),
      ...extras,
    ]));
    if (targetUrls.length === 0) {
      return params.pool.publishToAll(payload);
    }

    if (typeof params.pool.publishToUrls === "function") {
      return params.pool.publishToUrls(targetUrls, payload);
    }
    if (typeof params.pool.publishToUrl === "function") {
      const result = await params.pool.publishToUrl(targetUrls[0]!, payload);
      return {
        success: result.success,
        successCount: result.success ? 1 : 0,
        totalRelays: 1,
        results: [result],
        overallError: result.success ? undefined : (result.error ?? "Scoped publish failed")
      };
    }
    if (typeof params.pool.publishToRelay === "function") {
      const result = await params.pool.publishToRelay(targetUrls[0]!, payload);
      return {
        success: result.success,
        successCount: result.success ? 1 : 0,
        totalRelays: 1,
        results: [result],
        overallError: result.success ? undefined : (result.error ?? "Scoped publish failed")
      };
    }
    return params.pool.publishToAll(payload);
  }, [params.pool, params.relayUrl, params.communityRelayBroadcastUrls]);

  const publishToCommunityScopeWithRetry = useCallback(async (publishParams: Readonly<{
    event: NostrEvent;
    operation: string;
    maxAttempts?: number;
    baseBackoffMs?: number;
    allowGlobalFallback?: boolean;
  }>): Promise<MultiRelayPublishResult> => {
    const maxAttempts = Math.max(1, publishParams.maxAttempts ?? 3);
    const baseBackoffMs = Math.max(50, publishParams.baseBackoffMs ?? 200);
    const payload = JSON.stringify(["EVENT", publishParams.event]);
    let lastResult: MultiRelayPublishResult | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = await publishToCommunityScope(publishParams.event);
      if (result.success) {
        if (attempt > 1) {
          setState((prev) => ({
            ...prev,
            relayFeedback: {
              ...prev.relayFeedback,
              lastNotice: `${publishParams.operation} recovered after relay retry.`
            }
          }));
        }
        return result;
      }
      lastResult = result;
      if (attempt < maxAttempts) {
        await wait(baseBackoffMs * attempt);
      }
    }

    if (publishParams.allowGlobalFallback) {
      const fallbackResult = await params.pool.publishToAll(payload);
      if (fallbackResult.success) {
        setState((prev) => ({
          ...prev,
          relayFeedback: {
            ...prev.relayFeedback,
            lastNotice: `${publishParams.operation} used global relay fallback because scoped relays were unavailable.`
          }
        }));
        return fallbackResult;
      }
      lastResult = fallbackResult;
    }

    setState((prev) => ({
      ...prev,
      relayFeedback: {
        ...prev.relayFeedback,
        lastNotice: `${publishParams.operation} failed after relay retries.`
      }
    }));

    return lastResult ?? {
      success: false,
      successCount: 0,
      totalRelays: 0,
      results: [],
      overallError: `${publishParams.operation} failed`
    };
  }, [params.pool, publishToCommunityScope]);

  const publishGovernanceSealed = useCallback(async (
    governanceType: "proposed" | "vote" | "resolved",
    body: Readonly<Record<string, unknown>>,
  ): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
      throw new Error("Unlock your identity to participate in governance.");
    }
    const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
    if (!roomKeyHex) {
      throw new Error("Missing room key for this community on this device.");
    }
    const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
    const signedEvent = await groupService.sendSealedGovernance({
      groupId: params.groupId,
      roomKeyHex,
      governanceType,
      body,
    });
    const publishResult = await publishToCommunityScopeWithRetry({
      event: signedEvent,
      operation: `Governance ${governanceType}`,
      allowGlobalFallback: true,
    });
    assertRelayPublishSuccess(publishResult, {
      operation: "Could not publish governance event",
      fallback: "Failed to publish governance event.",
    });
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScopeWithRetry]);

  useEffect(() => {
    const myPublicKeyHex = params.myPublicKeyHex;
    const myPrivateKeyHex = params.myPrivateKeyHex;
    if (!params.enabled || !myPublicKeyHex || !myPrivateKeyHex) {
      return;
    }
    if (state.membership.status !== "member") {
      return;
    }
    let cancelled = false;
    const publishMembershipRestate = async (): Promise<void> => {
      try {
        const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
        if (!roomKeyHex || cancelled) {
          return;
        }
        const groupService = new GroupService(myPublicKeyHex, myPrivateKeyHex);
        const signedEvent = await groupService.sendSealedMembershipRestate({
          groupId: params.groupId,
          roomKeyHex,
        });
        await publishToCommunityScopeWithRetry({
          event: signedEvent,
          operation: "membership_restate",
          maxAttempts: 2,
        });
      } catch {
        // Best-effort stealth control-plane ping; roster also ingests foreign relay joins.
      }
    };
    void publishMembershipRestate();
    const timerId = window.setInterval(() => {
      void publishMembershipRestate();
    }, COMMUNITY_MEMBERSHIP_RESTATE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [
    params.enabled,
    params.groupId,
    params.myPrivateKeyHex,
    params.myPrivateKeyHex,
    publishToCommunityScopeWithRetry,
    state.membership.status,
  ]);

  const applyGovernanceAcceptedEffects = useCallback(async (
    proposal: GovernanceProposalRecord,
  ): Promise<void> => {
    if (appliedGovernanceProposalIdsRef.current.has(proposal.proposalId)) {
      return;
    }
    appliedGovernanceProposalIdsRef.current.add(proposal.proposalId);
    if (proposal.actionType === "update_descriptor") {
      const payload = proposal.payload;
      const name = "name" in payload && typeof payload.name === "string" ? payload.name : undefined;
      const about = "about" in payload && typeof payload.about === "string" ? payload.about : undefined;
      const picture = "picture" in payload && typeof payload.picture === "string" ? payload.picture : undefined;
      const access = "access" in payload && (
        payload.access === "open" || payload.access === "invite-only" || payload.access === "discoverable"
      ) ? payload.access : undefined;
      await updateMetadataRef.current({
        id: params.groupId,
        name: name ?? state.metadata?.name ?? params.groupId,
        about: about ?? state.metadata?.about,
        picture: picture ?? state.metadata?.picture,
        access: access ?? state.metadata?.access ?? "invite-only",
      }, { governanceProposalId: proposal.proposalId });
      toast.success("Community rename approved and applied.");
      return;
    }
    if (proposal.actionType === "expel_member") {
      const target = "targetPublicKeyHex" in proposal.payload
        ? proposal.payload.targetPublicKeyHex
        : null;
      if (!target) {
        return;
      }
      applyControlEvent(createMembershipControlEventBase({
        eventType: "COMMUNITY_MEMBER_EXPELLED",
        logicalEventId: proposal.lastEventId ?? `governance-expel:${proposal.proposalId}`,
        createdAtUnixMs: proposal.resolvedAtUnixMs ?? Date.now(),
        subjectPublicKeyHex: target,
      }));
      const operatorPk = params.myPublicKeyHex?.trim();
      if (operatorPk) {
        const conversationId = toGroupConversationId({
          groupId: params.groupId,
          relayUrl: params.relayUrl,
          communityId: params.communityId,
        });
        const groupForLedger: GroupConversation = {
          kind: "group",
          id: conversationId,
          groupId: params.groupId,
          relayUrl: params.relayUrl,
          communityId: params.communityId,
          displayName: state.metadata?.name ?? params.groupId,
          about: state.metadata?.about,
          avatar: state.metadata?.picture,
          access: state.metadata?.access ?? "invite-only",
          memberPubkeys: [...membersRef.current],
          adminPubkeys: params.myPublicKeyHex
            ? [params.myPublicKeyHex]
            : membersRef.current.slice(0, 1),
          lastMessage: "",
          unreadCount: 0,
          lastMessageTime: new Date(),
          memberCount: membersRef.current.length,
        };
        persistCommunityGovernanceMemberExpelled({
          publicKeyHex: operatorPk,
          group: groupForLedger,
          targetPublicKeyHex: target,
          lastEvidenceEventId: proposal.lastEventId ?? `governance-expel:${proposal.proposalId}`,
          updatedAtUnixMs: proposal.resolvedAtUnixMs ?? Date.now(),
          profileId: getResolvedProfileId(),
        });
      }
      toast.error(`Member ${target.slice(0, 8)}… expelled by community vote.`);
    }
  }, [
    applyControlEvent,
    createMembershipControlEventBase,
    params.communityId,
    params.groupId,
    params.myPublicKeyHex,
    params.relayUrl,
    state.metadata?.about,
    state.metadata?.access,
    state.metadata?.name,
    state.metadata?.picture,
  ]);

  const finalizeGovernanceProposal = useCallback(async (proposalId: string): Promise<void> => {
    if (governanceFinalizeInFlightRef.current.has(proposalId)) {
      return;
    }
    const proposal = governanceRef.current.proposalsById[proposalId];
    if (!proposal || proposal.resolution || !hasGovernanceQuorum(proposal)) {
      return;
    }
    governanceFinalizeInFlightRef.current.add(proposalId);
    try {
      await publishGovernanceSealed("resolved", {
        proposalId,
        resolution: "accepted",
      });
      ingestGovernanceEventRef.current({
        type: "RESOLVED",
        proposalId,
        resolution: "accepted",
        resolverPublicKeyHex: params.myPublicKeyHex as PublicKeyHex,
        createdAtUnixMs: Date.now(),
        logicalEventId: `local-resolve:${proposalId}`,
      });
    } catch (error) {
      toast.error(resolveUserFacingErrorMessage(error, "Failed to finalize governance proposal."));
    } finally {
      governanceFinalizeInFlightRef.current.delete(proposalId);
    }
  }, [params.myPublicKeyHex, publishGovernanceSealed]);

  const finalizeGovernanceProposalRejected = useCallback(async (proposalId: string): Promise<void> => {
    if (governanceFinalizeInFlightRef.current.has(proposalId)) {
      return;
    }
    const proposal = governanceRef.current.proposalsById[proposalId];
    if (
      !proposal
      || proposal.resolution
      || (!hasGovernanceRejectionQuorum(proposal) && !hasGovernanceVoteTie(proposal))
    ) {
      return;
    }
    governanceFinalizeInFlightRef.current.add(proposalId);
    try {
      await publishGovernanceSealed("resolved", {
        proposalId,
        resolution: "rejected",
      });
      ingestGovernanceEventRef.current({
        type: "RESOLVED",
        proposalId,
        resolution: "rejected",
        resolverPublicKeyHex: params.myPublicKeyHex as PublicKeyHex,
        createdAtUnixMs: Date.now(),
        logicalEventId: `local-resolve-reject:${proposalId}`,
      });
      toast.info(
        hasGovernanceVoteTie(proposal)
          ? "Governance proposal tied on votes and was closed without applying changes."
          : "Governance proposal was rejected by member vote.",
      );
    } catch (error) {
      toast.error(resolveUserFacingErrorMessage(error, "Failed to finalize governance rejection."));
    } finally {
      governanceFinalizeInFlightRef.current.delete(proposalId);
    }
  }, [params.myPublicKeyHex, publishGovernanceSealed]);

  const ingestGovernanceEvent = useCallback((event: GovernanceReducerEvent): void => {
    const nextGov = ingestCommunityGovernanceEvent(governanceScopeId, event);
    governanceRef.current = nextGov;

    const proposalId = event.proposalId;
    const proposal = nextGov.proposalsById[proposalId];
    if (!proposal) {
      return;
    }

    if (event.type === "VOTE_CAST" && !proposal.resolution && hasGovernanceQuorum(proposal)) {
      void finalizeGovernanceProposal(proposalId);
    }
    if (
      event.type === "VOTE_CAST"
      && !proposal.resolution
      && (hasGovernanceRejectionQuorum(proposal) || hasGovernanceVoteTie(proposal))
    ) {
      void finalizeGovernanceProposalRejected(proposalId);
    }
    if (event.type === "RESOLVED" && proposal.resolution === "accepted") {
      void applyGovernanceAcceptedEffects(proposal);
    }
  }, [applyGovernanceAcceptedEffects, finalizeGovernanceProposal, finalizeGovernanceProposalRejected, governanceScopeId]);

  ingestGovernanceEventRef.current = ingestGovernanceEvent;

  const expireGovernanceProposalsIfNeeded = useCallback(async (): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
      return;
    }
    const now = Date.now();
    const ids = listExpiredOpenGovernanceProposalIds(governanceRef.current, now);
    if (ids.length === 0) {
      return;
    }
    let closedCount = 0;
    for (const proposalId of ids) {
      if (governanceFinalizeInFlightRef.current.has(proposalId)) {
        continue;
      }
      const proposal = governanceRef.current.proposalsById[proposalId];
      if (!proposal || proposal.resolution) {
        continue;
      }
      governanceFinalizeInFlightRef.current.add(proposalId);
      try {
        await publishGovernanceSealed("resolved", {
          proposalId,
          resolution: "expired",
        });
        ingestGovernanceEventRef.current({
          type: "RESOLVED",
          proposalId,
          resolution: "expired",
          resolverPublicKeyHex: params.myPublicKeyHex,
          createdAtUnixMs: now,
          logicalEventId: `local-resolve-expired:${proposalId}`,
        });
        closedCount += 1;
      } catch (error) {
        logAppEvent({
          name: "groups.governance_expire_publish_failed",
          level: "warn",
          scope: { feature: "groups", action: "governance_expire" },
          context: {
            proposalIdHint: proposalId.slice(0, 16),
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } finally {
        governanceFinalizeInFlightRef.current.delete(proposalId);
      }
    }
    if (closedCount > 0) {
      toast.info(
        closedCount === 1
          ? "A governance proposal expired without a decision."
          : `${closedCount} governance proposals expired without a decision.`,
      );
    }
  }, [params.myPrivateKeyHex, params.myPublicKeyHex, publishGovernanceSealed]);

  useEffect(() => {
    if (params.enabled === false) {
      return;
    }
    const tick = (): void => {
      void expireGovernanceProposalsIfNeeded();
    };
    tick();
    if (typeof window === "undefined") {
      return;
    }
    const intervalId = window.setInterval(tick, 120_000);
    return () => window.clearInterval(intervalId);
  }, [expireGovernanceProposalsIfNeeded, params.enabled]);

  const contentTimeline = useMemo<ReadonlyArray<CommunityContentTimelineEntry>>(() => (
    state.messages.map((message) => ({
      logicalMessageId: message.id,
      communityId: params.communityId ?? params.groupId,
      keyEpoch: null,
      contentState: "visible",
      plaintextPreview: message.content,
      senderPublicKeyHex: message.pubkey as PublicKeyHex,
      createdAtUnixMs: message.created_at * 1000,
      lastObservedAtUnixMs: message.created_at * 1000,
      sourceEventId: message.id,
      attachmentDescriptorIds: [],
    }))
  ), [params.communityId, params.groupId, state.messages]);

  const sendMessage = useCallback(async (msgParams: Readonly<{ content: string }>): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    try {
      const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
      if (!roomKeyHex) throw new Error("Missing Room Key");

      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const signedEvent = await groupService.sendSealedMessage({
        groupId: params.groupId,
        roomKeyHex,
        content: msgParams.content
      });

      const publishResult = await publishToCommunityScope(signedEvent);
      assertRelayPublishSuccess(publishResult, {
        operation: "Could not send community message",
        fallback: "Failed to send message. Check relay connection and try again.",
      });

      // Optimistic update
      const optimisticMsg: GroupMessageEvent = {
        id: signedEvent.id,
        pubkey: params.myPublicKeyHex,
        created_at: Math.floor(Date.now() / 1000),
        content: msgParams.content
      };

      setState((prev: Nip29GroupState): Nip29GroupState => {
        if (prev.messages.some((m): boolean => m.id === optimisticMsg.id)) {
          return prev;
        }
        const newMessages = mergeGroupMessagesDescending({
          previous: prev.messages,
          incoming: [optimisticMsg]
        });

        // Emit optimistic message to MessageBus
        const unifiedOptimistic: Message = {
          id: optimisticMsg.id,
          kind: 'user',
          content: optimisticMsg.content,
          timestamp: new Date(optimisticMsg.created_at * 1000),
          isOutgoing: true,
          status: 'sending',
          senderPubkey: params.myPublicKeyHex as PublicKeyHex,
          conversationId
        };
        messageBus.emitNewMessage(conversationId, unifiedOptimistic);

        return { ...prev, messages: newMessages };
      });
    } catch (e: unknown) {
      toast.error(resolveUserFacingErrorMessage(
        e,
        "Failed to send message. Check relay connection and try again.",
      ));
    }
  }, [conversationId, params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScope]);

  const sendVoteKick = useCallback(async (targetPubkey: string, reason?: string): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    try {
      const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
      if (!roomKeyHex) throw new Error("Missing Room Key");

      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const signedEvent = await groupService.sendSealedVote({
        groupId: params.groupId,
        roomKeyHex,
        type: "kick",
        targetPubkey,
        reason
      });

      const publishResult = await publishToCommunityScope(signedEvent);
      assertRelayPublishSuccess(publishResult, {
        operation: "Could not publish vote to remove member",
        fallback: "Failed to publish vote. Retry after relay reconnect.",
      });
      toast.success("Vote to kick published");
    } catch (e: unknown) {
      toast.error(resolveUserFacingErrorMessage(
        e,
        "Failed to publish vote. Retry after relay reconnect.",
      ));
    }
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScope]);

  const rotateRoomKey = useCallback(async (): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    try {
      const newKey = await cryptoService.generateRoomKey();
      await roomKeyStore.rotateRoomKey(params.groupId, newKey);

      // Distribute new key to all non-expelled members via NIP-17
      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const currentMetadata = state.metadata || {
        id: params.groupId,
        name: params.groupId,
        access: "invite-only"
      };

      let count = 0;
      for (const memberPk of members) {
        if (state.expelledMembers.includes(memberPk)) continue;
        if (memberPk === params.myPublicKeyHex) continue;

        const { giftWrapEvent } = await groupService.distributeRoomKey({
          recipientPubkey: memberPk,
          groupId: params.groupId,
          roomKeyHex: newKey,
          metadata: currentMetadata,
          relayUrl: params.relayUrl,
          communityId: params.communityId
        });
        await params.pool.publishToAll(JSON.stringify(["EVENT", giftWrapEvent]));
        count++;
      }

      toast.success(`Room Key rotated and distributed to ${count} members.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to rotate Room Key");
    }
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool, members, state.expelledMembers, state.metadata]);

  const leaveGroup = useCallback(async (): Promise<void> => {
    let disbandPublished = false;
    const activeMembersBeforeLeave = membersRef.current.filter((memberPubkey) => (
      !leftMembersRef.current.includes(memberPubkey)
      && !expelledMembersRef.current.includes(memberPubkey)
    ));
    const remainingKnownMembers = params.myPublicKeyHex
      ? activeMembersBeforeLeave.filter((memberPubkey) => memberPubkey !== params.myPublicKeyHex)
      : activeMembersBeforeLeave;
    const shouldAttemptAutoDisband = remainingKnownMembers.length === 0;

    if (params.myPublicKeyHex && params.myPrivateKeyHex) {
      const profileId = getResolvedProfileId();
      enqueueCommunityLeaveOutboxItem({
        publicKeyHex: params.myPublicKeyHex,
        groupId: params.groupId,
        relayUrl: params.relayUrl,
        communityId: params.communityId,
        profileId,
      });
      try {
        const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
        const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);

        // 1. Tell the RELAY directly (NIP-29 Kind 9022)
        const nip29Leave = await groupService.sendNip29Leave({ groupId: params.groupId });
        const nip29LeaveResult = await publishToCommunityScopeWithRetry({
          event: nip29Leave,
          operation: "Leave event",
          allowGlobalFallback: true
        });
        recordCommunityLeaveRelayPublishOutcome({
          publicKeyHex: params.myPublicKeyHex,
          groupId: params.groupId,
          relayUrl: params.relayUrl,
          success: nip29LeaveResult.success,
          errorMessage: nip29LeaveResult.overallError,
          profileId,
        });
        if (!nip29LeaveResult.success) {
          toast.warning(formatRelayPublishFailureMessage(nip29LeaveResult, {
            operation: "Could not confirm leave on relays",
            fallback: "Leave saved locally; relay publish will retry when the network allows.",
          }));
        }

        // 2. Tell other CLIENTS via sealed channel (Kind 10105) — best-effort after durable local leave
        if (roomKeyHex && nip29LeaveResult.success) {
          const signedEvent = await groupService.sendSealedLeave({
            groupId: params.groupId,
            roomKeyHex
          });
          const sealedLeaveResult = await publishToCommunityScopeWithRetry({
            event: signedEvent,
            operation: "Sealed leave event",
            allowGlobalFallback: true
          });
          if (!sealedLeaveResult.success) {
            logAppEvent({
              name: "groups.leave_sealed_publish_failed",
              level: "warn",
              scope: { feature: "groups", action: "leave" },
              context: {
                groupIdHint: params.groupId.slice(0, 24),
                error: sealedLeaveResult.overallError ?? "publish_failed",
              },
            });
          }
        }

        if (shouldAttemptAutoDisband && roomKeyHex) {
          logAppEvent({
            name: "groups.auto_disband_attempt",
            level: "info",
            scope: { feature: "groups", action: "disband" },
            context: {
              groupIdHint: params.groupId.length > 24
                ? `${params.groupId.slice(0, 12)}...${params.groupId.slice(-8)}`
                : params.groupId,
              reason: "last_known_member_left",
              knownActiveMemberCountBeforeLeave: activeMembersBeforeLeave.length,
            },
          });
          const disbandEvent = await groupService.sendSealedDisband({
            groupId: params.groupId,
            roomKeyHex,
          });
          const disbandResult = await publishToCommunityScopeWithRetry({
            event: disbandEvent,
            operation: "Disband event",
            allowGlobalFallback: true
          });
          if (disbandResult.success) {
            const disbandTimestamp = Math.floor(Date.now() / 1000);
            applyControlEvent(createTerminalControlEventBase({
              logicalEventId: disbandEvent.id,
              createdAtUnixMs: disbandTimestamp,
            }));
            disbandPublished = true;
            logAppEvent({
              name: "groups.auto_disband_result",
              level: "info",
              scope: { feature: "groups", action: "disband" },
              context: {
                groupIdHint: params.groupId.length > 24
                  ? `${params.groupId.slice(0, 12)}...${params.groupId.slice(-8)}`
                  : params.groupId,
                result: "published",
                knownActiveMemberCountBeforeLeave: activeMembersBeforeLeave.length,
              },
            });
          } else {
            logAppEvent({
              name: "groups.auto_disband_result",
              level: "warn",
              scope: { feature: "groups", action: "disband" },
              context: {
                groupIdHint: params.groupId.length > 24
                  ? `${params.groupId.slice(0, 12)}...${params.groupId.slice(-8)}`
                  : params.groupId,
                result: "failed_publish",
                reason: disbandResult.overallError ?? "publish_failed",
                knownActiveMemberCountBeforeLeave: activeMembersBeforeLeave.length,
              },
            });
          }
        } else if (shouldAttemptAutoDisband && !roomKeyHex) {
          logAppEvent({
            name: "groups.auto_disband_result",
            level: "warn",
            scope: { feature: "groups", action: "disband" },
            context: {
              groupIdHint: params.groupId.length > 24
                ? `${params.groupId.slice(0, 12)}...${params.groupId.slice(-8)}`
                : params.groupId,
              result: "skipped_missing_room_key",
              knownActiveMemberCountBeforeLeave: activeMembersBeforeLeave.length,
            },
          });
        }
      } catch (e: any) {
        console.error("Failed to broadcast leave event(s):", e);
        toast.error(resolveUserFacingErrorMessage(
          e,
          "Failed to leave via scoped relay. Try again or check relay status.",
        ));
      }

      // 3. Publish self-encrypted leave proof to the user's relay set.
      // This survives across devices and prevents left communities from
      // being resurrected when restoring from a stale backup.
      recordCommunityLeaveProof({
        publicKeyHex: params.myPublicKeyHex,
        privateKeyHex: params.myPrivateKeyHex,
        groupId: params.groupId,
        relayUrl: params.relayUrl,
        pool: params.pool,
        profileId: getResolvedProfileId(),
      }).catch((err) => {
        console.warn("[LeaveProof] Failed to publish leave proof (best-effort):", err);
      });
    }
    await roomKeyStore.deleteRoomKey(params.groupId);
    toast.success(disbandPublished ? "Community disbanded" : "Disconnected from community");
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScopeWithRetry]);

  const deleteMessage = useCallback(async (deleteParams: Readonly<{ eventId: string; reason?: string }>): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
    const deletionEvent = await groupService.hideMessage({
      groupId: params.groupId,
      eventId: deleteParams.eventId,
      reason: deleteParams.reason
    });
    const deletionResult = await publishToCommunityScope(deletionEvent);
    if (!deletionResult.success) {
      assertRelayPublishSuccess(deletionResult, {
        operation: "Could not publish message deletion",
        fallback: "Failed to delete message on community relays.",
      });
    }
    const deletedAtMs = Date.now();
    deletedMessageTombstonesRef.current.set(deleteParams.eventId, deletedAtMs);
    messageBus.emitMessageDeleted(conversationId, deleteParams.eventId);
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter(m => m.id !== deleteParams.eventId)
    }));
    if (isTauri() && params.myPublicKeyHex) {
      const profileId = getResolvedProfileId();
      dbInsertGroupTombstone({
        event_id: deleteParams.eventId,
        profile_id: profileId,
        deleted_at: deletedAtMs,
        deleted_by: params.myPublicKeyHex,
      }).catch(() => {});
    }
  }, [conversationId, params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScope]);

  const noop = async () => { };
  const setGroupStatus = noop;

  const updateMetadata = useCallback(async (
    nextMetadata: GroupMetadata,
    options?: Readonly<{ governanceProposalId?: string }>,
  ): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
      throw new Error("Unlock your identity to update community settings.");
    }
    const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
    if (!roomKeyHex) {
      throw new Error("Missing room key for this community on this device.");
    }

    const previousVersion = descriptorVersionRef.current
      ?? state.metadata?.descriptorVersion
      ?? 1;
    const nextVersion = previousVersion + 1;
    const resolvedName = pickPreferredCommunityDisplayName(
      nextMetadata.name,
      state.metadata?.name,
      { groupId: params.groupId, communityId: params.communityId },
    );
    const mergedMetadata: GroupMetadata = {
      ...state.metadata,
      ...nextMetadata,
      id: params.groupId,
      name: resolvedName,
      descriptorVersion: nextVersion,
    };

    const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
    const sealedEvent = await groupService.sendSealedDescriptorUpdated({
      groupId: params.groupId,
      roomKeyHex,
      metadata: mergedMetadata,
      descriptorVersion: nextVersion,
    });
    const relayMetadataEvent = await groupService.sendRelayMetadataHint({
      groupId: params.groupId,
      metadata: mergedMetadata,
    });

    const sealedResult = await publishToCommunityScopeWithRetry({
      event: sealedEvent,
      operation: "Descriptor update (sealed)",
      allowGlobalFallback: true,
    });
    assertRelayPublishSuccess(sealedResult, {
      operation: "Could not publish community settings update",
      fallback: "Failed to publish community settings update.",
    });

    const relayMetaResult = await publishToCommunityScopeWithRetry({
      event: relayMetadataEvent,
      operation: "Descriptor update (relay metadata)",
      allowGlobalFallback: true,
    });
    if (!relayMetaResult.success) {
      logAppEvent({
        name: "groups.descriptor_relay_metadata_publish_failed",
        level: "warn",
        scope: { feature: "groups", action: "descriptor_update" },
        context: {
          groupIdHint: params.groupId.slice(0, 24),
          error: relayMetaResult.overallError ?? "publish_failed",
        },
      });
    }

    descriptorVersionRef.current = nextVersion;
    setState((prev) => ({ ...prev, metadata: mergedMetadata }));

    dispatchGroupDescriptorUpdated({
      groupId: params.groupId,
      relayUrl: params.relayUrl,
      communityId: params.communityId,
      displayName: mergedMetadata.name,
      about: mergedMetadata.about,
      avatar: mergedMetadata.picture,
      access: mergedMetadata.access,
      descriptorVersion: nextVersion,
      lastEvidenceEventId: sealedEvent.id,
      publicKeyHex: params.myPublicKeyHex,
      ...(options?.governanceProposalId
        ? { governanceProposalId: options.governanceProposalId }
        : {}),
    });

    logAppEvent({
      name: "groups.descriptor_updated",
      level: "info",
      scope: { feature: "groups", action: "descriptor_update" },
      context: {
        groupId: params.groupId,
        relayUrl: params.relayUrl,
        descriptorVersion: nextVersion,
      },
    });
  }, [
    params.communityId,
    params.groupId,
    params.myPrivateKeyHex,
    params.myPublicKeyHex,
    params.relayUrl,
    publishToCommunityScopeWithRetry,
    state.metadata,
  ]);
  updateMetadataRef.current = updateMetadata;

  const proposeDescriptorUpdate = useCallback(async (nextMetadata: GroupMetadata): Promise<void> => {
    const activeMemberCount = membersRef.current.filter(
      (pubkey) => !leftMembersRef.current.includes(pubkey) && !expelledMembersRef.current.includes(pubkey),
    ).length;
    if (activeMemberCount <= 1) {
      await updateMetadata(nextMetadata);
      return;
    }
    if (!params.myPublicKeyHex) {
      throw new Error("Unlock your identity to propose community changes.");
    }
    const proposalId = `gov-desc-${params.groupId.slice(0, 8)}-${Date.now()}-${createRandomId()}`;
    const quorumThreshold = computeGovernanceQuorumThreshold(activeMemberCount);
    const payload = {
      name: nextMetadata.name,
      about: nextMetadata.about,
      picture: nextMetadata.picture,
      access: nextMetadata.access,
    };
    const proposalExpiresAtUnixMs = computeGovernanceProposalExpiresAtUnixMs();
    await publishGovernanceSealed("proposed", {
      proposalId,
      actionType: "update_descriptor",
      quorumThreshold,
      proposalExpiresAtUnixMs,
      payload,
    });
    ingestGovernanceEvent({
      type: "PROPOSED",
      proposalId,
      actionType: "update_descriptor",
      proposerPublicKeyHex: params.myPublicKeyHex,
      createdAtUnixMs: Date.now(),
      quorumThreshold,
      proposalExpiresAtUnixMs,
      payload,
      logicalEventId: proposalId,
    });
    await publishGovernanceSealed("vote", { proposalId, vote: "approve" });
    ingestGovernanceEvent({
      type: "VOTE_CAST",
      proposalId,
      voterPublicKeyHex: params.myPublicKeyHex,
      vote: "approve",
      createdAtUnixMs: Date.now(),
      logicalEventId: `${proposalId}:vote:${params.myPublicKeyHex}`,
    });
    toast.info("Rename proposal published. Waiting for other members to vote.");
  }, [ingestGovernanceEvent, params.groupId, params.myPublicKeyHex, publishGovernanceSealed, updateMetadata]);

  const proposeExpelMember = useCallback(async (expelParams: Readonly<{
    targetPublicKeyHex: PublicKeyHex;
    reason?: string;
  }>): Promise<void> => {
    const activeMemberCount = membersRef.current.filter(
      (pubkey) => !leftMembersRef.current.includes(pubkey) && !expelledMembersRef.current.includes(pubkey),
    ).length;
    if (activeMemberCount <= 1) {
      throw new Error("Expelling members requires at least one other active member.");
    }
    if (!params.myPublicKeyHex) {
      throw new Error("Unlock your identity to propose expulsion.");
    }
    const proposalId = `gov-expel-${params.groupId.slice(0, 8)}-${Date.now()}-${createRandomId()}`;
    const quorumThreshold = computeGovernanceQuorumThreshold(activeMemberCount);
    const payload = {
      targetPublicKeyHex: expelParams.targetPublicKeyHex,
      ...(expelParams.reason ? { reason: expelParams.reason } : {}),
    };
    const proposalExpiresAtUnixMs = computeGovernanceProposalExpiresAtUnixMs();
    await publishGovernanceSealed("proposed", {
      proposalId,
      actionType: "expel_member",
      quorumThreshold,
      proposalExpiresAtUnixMs,
      payload,
    });
    ingestGovernanceEvent({
      type: "PROPOSED",
      proposalId,
      actionType: "expel_member",
      proposerPublicKeyHex: params.myPublicKeyHex,
      createdAtUnixMs: Date.now(),
      quorumThreshold,
      proposalExpiresAtUnixMs,
      payload,
      logicalEventId: proposalId,
    });
    await publishGovernanceSealed("vote", { proposalId, vote: "approve" });
    ingestGovernanceEvent({
      type: "VOTE_CAST",
      proposalId,
      voterPublicKeyHex: params.myPublicKeyHex,
      vote: "approve",
      createdAtUnixMs: Date.now(),
      logicalEventId: `${proposalId}:vote:${params.myPublicKeyHex}`,
    });
    toast.info("Expulsion proposal published. Waiting for member votes.");
  }, [ingestGovernanceEvent, params.groupId, params.myPublicKeyHex, publishGovernanceSealed]);

  const castGovernanceVote = useCallback(async (voteParams: Readonly<{
    proposalId: string;
    vote: CommunityGovernanceVote;
  }>): Promise<void> => {
    if (!params.myPublicKeyHex) {
      throw new Error("Unlock your identity to vote.");
    }
    await publishGovernanceSealed("vote", {
      proposalId: voteParams.proposalId,
      vote: voteParams.vote,
    });
    ingestGovernanceEvent({
      type: "VOTE_CAST",
      proposalId: voteParams.proposalId,
      voterPublicKeyHex: params.myPublicKeyHex,
      vote: voteParams.vote,
      createdAtUnixMs: Date.now(),
      logicalEventId: `${voteParams.proposalId}:vote:${params.myPublicKeyHex}:${Date.now()}`,
    });
    toast.success("Vote recorded.");
  }, [ingestGovernanceEvent, params.myPublicKeyHex, publishGovernanceSealed]);

  const requestJoin = useCallback(async (): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    if (state.membership.status === "member" || members.includes(params.myPublicKeyHex)) {
      setState((prev) => ({ ...prev, joinRequestState: "accepted", joinRequestBlockReason: "already_member" }));
      incrementAbuseMetric("join_request_suppressed");
      toast.info("You are already a member of this community.");
      return;
    }
    if (joinRequestPendingKey) {
      const current = getJoinRequestStorageState(joinRequestPendingKey);
      if (current.state === "pending") {
        setState((prev) => ({ ...prev, joinRequestState: "pending", joinRequestBlockReason: "pending_request_exists" }));
        incrementAbuseMetric("join_request_suppressed");
        toast.info("Join request already pending. Wait for it to be accepted or declined.");
        return;
      }
      if (current.state === "cooldown") {
        const seconds = Math.ceil((current.remainingCooldownMs ?? 0) / 1000);
        setState((prev) => ({ ...prev, joinRequestState: "cooldown", joinRequestBlockReason: "cooldown_active" }));
        incrementAbuseMetric("join_request_suppressed");
        toast.info(`Join request cooldown active. Try again in ${seconds}s.`);
        return;
      }
      if (current.state === "denied") {
        setState((prev) => ({ ...prev, joinRequestState: "denied", joinRequestBlockReason: "denied_request" }));
        incrementAbuseMetric("join_request_suppressed");
        toast.info("A recent join request was denied. Please wait before sending another request.");
        return;
      }
    }
    try {
      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const joinEvent = await groupService.sendNip29Join({ groupId: params.groupId });
      const joinResult = await publishToCommunityScopeWithRetry({
        event: joinEvent,
        operation: "Join request event",
        allowGlobalFallback: false
      });
      assertRelayPublishSuccess(joinResult, {
        operation: "Could not publish join request",
        fallback: "Failed to send join request. Confirm relay scope and retry.",
      });
      if (joinRequestPendingKey) {
        setJoinRequestStorageState(joinRequestPendingKey, { state: "pending" });
      }
      setState((prev) => ({ ...prev, joinRequestState: "pending", joinRequestBlockReason: undefined }));
      toast.success("Join request sent to relay");
    } catch (e: unknown) {
      const failureState = classifyJoinRequestFailure(e);
      if (joinRequestPendingKey) {
        setJoinRequestStorageState(joinRequestPendingKey, { state: failureState });
      }
      setState((prev) => ({
        ...prev,
        joinRequestState: failureState,
        joinRequestBlockReason: failureState === "denied" ? "denied_request" : "cooldown_active"
      }));
      toast.error(
        failureState === "denied"
          ? "Join request denied by relay policy. Retry later or contact community admins."
          : resolveUserFacingErrorMessage(
            e,
            "Failed to send join request. Confirm relay scope and retry.",
          ),
      );
    }
  }, [joinRequestPendingKey, members, params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScopeWithRetry, state.membership.status]);
  const approveJoin = noop;
  const denyJoin = noop;
  const approveAllJoinRequests = noop;
  const denyAllJoinRequests = noop;
  const putUser = noop;
  const removeUser = noop;
  const promoteUser = noop;
  const demoteUser = noop;

  const result: UseSealedCommunityResult = useMemo((): UseSealedCommunityResult => {
    return {
      state,
      contentTimeline,
      refresh,
      clearLocalTerminalMembershipEvidence,
      requestJoin,
      approveJoin,
      denyJoin,
      approveAllJoinRequests,
      denyAllJoinRequests,
      sendMessage,
      sendVoteKick,
      proposeDescriptorUpdate,
      proposeExpelMember,
      castGovernanceVote,
      rotateRoomKey,
      updateMetadata,
      setGroupStatus,
      putUser,
      removeUser,
      promoteUser,
      demoteUser,
      leaveGroup,
      deleteMessage,
      members,
      admins: []
    };
  }, [
    state,
    contentTimeline,
    refresh,
    clearLocalTerminalMembershipEvidence,
    requestJoin,
    approveJoin,
    denyJoin,
    approveAllJoinRequests,
    denyAllJoinRequests,
    sendMessage,
    sendVoteKick,
    proposeDescriptorUpdate,
    proposeExpelMember,
    castGovernanceVote,
    rotateRoomKey,
    updateMetadata,
    setGroupStatus,
    putUser,
    removeUser,
    promoteUser,
    demoteUser,
    leaveGroup,
    deleteMessage,
    members,
  ]);

  return result;
};
