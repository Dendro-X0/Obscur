"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
  transitionCommunityConnection
} from "../../messaging/state-machines/community-membership-machine";
import { messageBus } from "../../messaging/services/message-bus";
import type { Message, JoinRequestBlockReason } from "../../messaging/types";
import { toGroupConversationId } from "../utils/group-conversation-id";
import { normalizeRelayUrl as normalizeRelayUrlBase } from "@dweb/nostr/relay-utils";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { incrementAbuseMetric } from "@/app/shared/abuse-observability";
import { recordMalformedEventQuarantinedRisk } from "@/app/shared/sybil-risk-signals";
import {
  createCommunityLedgerState,
  reduceCommunityLedger,
  selectActiveMembers,
  selectExpelledMembers,
  selectLeftMembers,
  selectMembershipStatus,
  toCommunityLedgerEventFromControlEvent,
  type CommunityLedgerEvent,
  type CommunityLedgerState
} from "../services/community-ledger-reducer";
import {
  projectCommunityMemberRoster,
  seedCommunityMemberLedgerMembers,
} from "../services/community-member-roster-projection";
import {
  type RelayEvidencePolicyParams,
} from "../services/community-relay-evidence-policy";
import { resolveEnhancedSnapshotApplication } from "../services/community-member-snapshot-policy";

export const normalizeRelayUrl = (relayUrl: string): string => {
  const normalized = normalizeRelayUrlBase(relayUrl);
  if (/^[a-z]+:\/\/$/i.test(normalized)) return normalized;
  return normalized.replace(/\/+$/g, "");
};

export const GROUP_MEMBERSHIP_SNAPSHOT_EVENT = "obscur:group-membership-snapshot";
export const COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT = "obscur:community-known-participants-observed";

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
  groupId: string;
  communityId?: string;
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
  enabled?: boolean;
  initialMembers?: ReadonlyArray<PublicKeyHex>;
}>;

type UseSealedCommunityResult = Readonly<{
  state: Nip29GroupState;
  contentTimeline: ReadonlyArray<CommunityContentTimelineEntry>;
  refresh: () => void;
  requestJoin: () => Promise<void>;
  approveJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  denyJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  approveAllJoinRequests: () => Promise<void>;
  denyAllJoinRequests: () => Promise<void>;
  sendMessage: (params: Readonly<{ content: string }>) => Promise<void>;
  sendVoteKick: (targetPubkey: string, reason?: string) => Promise<void>;
  rotateRoomKey: () => Promise<void>;
  updateMetadata: (params: Readonly<GroupMetadata>) => Promise<void>;
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
}>): string => {
  return [
    JOIN_REQUEST_PENDING_PREFIX,
    params.myPublicKeyHex,
    normalizeRelayUrl(params.relayUrl),
    params.groupId
  ].join(":");
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
    leftMembers: []
  };
};

const createRandomId = (): string => Math.random().toString(36).slice(2);
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
type RelayEvidenceRuntimeState = Omit<RelayEvidencePolicyParams, "nowMs">;

export const useSealedCommunity = (params: UseSealedCommunityParams): UseSealedCommunityResult => {
  const dedupeMemberPubkeys = useCallback((values: ReadonlyArray<PublicKeyHex>): ReadonlyArray<PublicKeyHex> => (
    Array.from(new Set(values))
  ), []);
  const initialHasLocalMembershipEvidence = Boolean(
    params.myPublicKeyHex
    && (params.initialMembers ?? []).includes(params.myPublicKeyHex)
  );
  const [localMembershipEvidence, setLocalMembershipEvidence] = useState<boolean>(initialHasLocalMembershipEvidence);
  const [state, setState] = useState<Nip29GroupState>(() => createInitialState());
  const [members, setMembers] = useState<ReadonlyArray<PublicKeyHex>>([]);
  const [chatPerformanceV2Enabled, setChatPerformanceV2Enabled] = useState<boolean>(() => PrivacySettingsService.getSettings().chatPerformanceV2);
  const ledgerRef = useRef<CommunityLedgerState>(createCommunityLedgerState());
  const localMembershipEvidenceRef = useRef<boolean>(initialHasLocalMembershipEvidence);
  const membersRef = useRef<ReadonlyArray<PublicKeyHex>>([]);
  const relayEvidenceRef = useRef<RelayEvidenceRuntimeState>({
    subscriptionEstablishedAt: null,
    lastEventReceivedAt: null,
    eoseReceivedAt: null,
    eventCount: 0,
  });
  const leftMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(state.leftMembers);
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
  const realtimeFlushFrameRef = useRef<number | null>(null);
  const deletedMessageTombstonesRef = useRef<Map<string, number>>(new Map());
  const initialMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(params.initialMembers ?? []);
  const conversationId = useMemo(
    () => toGroupConversationId({ groupId: params.groupId, relayUrl: params.relayUrl, communityId: params.communityId }),
    [params.groupId, params.relayUrl, params.communityId]
  );
  const joinRequestPendingKey = useMemo(() => {
    if (!params.myPublicKeyHex) return null;
    return toJoinRequestPendingKey({
      relayUrl: params.relayUrl,
      groupId: params.groupId,
      myPublicKeyHex: params.myPublicKeyHex
    });
  }, [params.groupId, params.myPublicKeyHex, params.relayUrl]);

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

  const applyLedgerEvent = useCallback((event: CommunityLedgerEvent): void => {
    const nextLedger = reduceCommunityLedger(ledgerRef.current, event);
    if (nextLedger === ledgerRef.current) return;
    ledgerRef.current = nextLedger;
    const activeMembers = selectActiveMembers(nextLedger);
    const leftMembers = selectLeftMembers(nextLedger);
    const expelledMembers = selectExpelledMembers(nextLedger);
    const myMembership = selectMembershipStatus(nextLedger, params.myPublicKeyHex);

    setMembers(activeMembers);
    setState((prev) => ({
      ...prev,
      leftMembers,
      expelledMembers,
      disbandedAt: nextLedger.disbandedAt,
      membership: { ...prev.membership, status: myMembership }
    }));
  }, [params.myPublicKeyHex]);

  const applyControlEvent = useCallback((event: CommunityControlEvent): void => {
    const ledgerEvent = toCommunityLedgerEventFromControlEvent(event);
    if (!ledgerEvent) {
      return;
    }
    applyLedgerEvent(ledgerEvent);
  }, [applyLedgerEvent]);

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
    for (const [messageId, deletedAt] of deletedMessageTombstonesRef.current.entries()) {
      if (nowMs - deletedAt > GROUP_DELETE_TOMBSTONE_TTL_MS) {
        deletedMessageTombstonesRef.current.delete(messageId);
      }
    }
    const filtered = deduped.filter((entry) => {
      const deletedAt = deletedMessageTombstonesRef.current.get(entry.groupMessage.id);
      if (typeof deletedAt !== "number") return true;
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
  }, [conversationId]);

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
  }, [state.leftMembers, state.expelledMembers, state.disbandedAt]);

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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("obscur:group-remove", { detail: conversationId }));
    }
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
    if (typeof window === "undefined") {
      return;
    }
    window.dispatchEvent(new CustomEvent(GROUP_MEMBERSHIP_SNAPSHOT_EVENT, {
      detail: {
        groupId: params.groupId,
        relayUrl: normalizeRelayUrl(params.relayUrl),
        communityId: params.communityId,
        activeMemberPubkeys: publishedSnapshotMembers,
        leftMembers: state.leftMembers,
        expelledMembers: state.expelledMembers,
        disbandedAt: state.disbandedAt ?? null,
      },
    }));
  }, [params.communityId, params.groupId, params.relayUrl, publishedSnapshotMembers, state.disbandedAt, state.expelledMembers, state.leftMembers]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (observedKnownParticipants.length === 0) {
      return;
    }
    window.dispatchEvent(new CustomEvent(COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT, {
      detail: {
        groupId: params.groupId,
        relayUrl: normalizeRelayUrl(params.relayUrl),
        communityId: params.communityId,
        conversationId,
        participantPubkeys: observedKnownParticipants,
      },
    }));
  }, [conversationId, observedKnownParticipants, params.communityId, params.groupId, params.relayUrl]);

  useEffect(() => {
    if (!params.myPublicKeyHex || !localMembershipEvidence) return;
    if (disbandedAtRef.current !== undefined) return;
    if (leftMembersRef.current.includes(params.myPublicKeyHex)) return;
    if (expelledMembersRef.current.includes(params.myPublicKeyHex)) return;
    if (membersRef.current.includes(params.myPublicKeyHex)) return;
    applyControlEvent(createMembershipControlEventBase({
      eventType: "COMMUNITY_MEMBER_JOINED",
      logicalEventId: `local-bootstrap:${params.myPublicKeyHex}`,
      createdAtUnixMs: 0,
      subjectPublicKeyHex: params.myPublicKeyHex,
    }));
  }, [applyControlEvent, createMembershipControlEventBase, localMembershipEvidence, params.myPublicKeyHex]);

  useEffect(() => {
    const seededMembers = seedCommunityMemberLedgerMembers({
      initialMembers: initialMembersRef.current,
      localMemberPubkey: params.myPublicKeyHex,
      hasLocalMembershipEvidence: localMembershipEvidence,
    });
    const nextLedger = createCommunityLedgerState(seededMembers);
    disbandHandledRef.current = false;
    deletedMessageTombstonesRef.current.clear();
    ledgerRef.current = nextLedger;
    const nextMembers = selectActiveMembers(nextLedger);
    const nextLeftMembers = selectLeftMembers(nextLedger);
    const nextExpelledMembers = selectExpelledMembers(nextLedger);
    const nextMyMembership = selectMembershipStatus(nextLedger, params.myPublicKeyHex);

    setMembers(nextMembers);
    setState((prev) => ({
      ...createInitialState(),
      status: prev.status === "error" ? "error" : "idle",
      leftMembers: nextLeftMembers,
      expelledMembers: nextExpelledMembers,
      disbandedAt: nextLedger.disbandedAt,
      membership: { ...prev.membership, status: nextMyMembership }
    }));
  }, [params.groupId, params.relayUrl, params.myPublicKeyHex]);

  useEffect(() => {
    const compatibilitySeedMembers = dedupeMemberPubkeys([
      ...(params.initialMembers ?? []),
      ...(localMembershipEvidence && params.myPublicKeyHex ? [params.myPublicKeyHex] : []),
    ]);
    if (compatibilitySeedMembers.length === 0) return;
    if (disbandedAtRef.current !== undefined) return;

    const activeMembers = membersRef.current;
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

    const nextMissingMembers = compatibilitySeedMembers.filter((pubkey) => (
      !activeMembers.includes(pubkey)
      && !leftMembersRef.current.includes(pubkey)
      && !expelledMembersRef.current.includes(pubkey)
    ));
    if (nextMissingMembers.length === 0) {
      return;
    }

    nextMissingMembers.forEach((pubkey) => {
      applyLedgerEvent({ type: "MEMBER_JOINED", pubkey, timestamp: 0 });
    });
  }, [applyLedgerEvent, dedupeMemberPubkeys, localMembershipEvidence, params.initialMembers, params.myPublicKeyHex]);

  useEffect((): (() => void) => {
    if (!params.groupId || params.enabled === false) {
      return (): void => { };
    }
    const scopedRelayUrl = toScopedRelayUrl(params.relayUrl);

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
            applyControlEvent(createTerminalControlEventBase({
              logicalEventId: event.id,
              createdAtUnixMs: ts,
            }));
            return;
          }

          if (innerPayload.type === "community.created") {
            const ts = innerPayload.created_at || event.created_at;
            if (innerPayload.metadata && typeof innerPayload.metadata === "object") {
              setState((prev) => ({
                ...prev,
                metadata: {
                  id: params.groupId,
                  name: typeof innerPayload.metadata.name === "string" ? innerPayload.metadata.name : (prev.metadata?.name ?? params.groupId),
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
                }
              }));
            }
            applyControlEvent(createMembershipControlEventBase({
              eventType: "COMMUNITY_MEMBER_JOINED",
              logicalEventId: event.id,
              createdAtUnixMs: ts,
              subjectPublicKeyHex: actor,
            }));
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
              applyControlEvent(createMembershipControlEventBase({
                eventType: "COMMUNITY_MEMBER_EXPELLED",
                logicalEventId: event.id,
                createdAtUnixMs: event.created_at,
                subjectPublicKeyHex: target,
              }));
              toast.error(`Consensus reached: Member ${target.slice(0, 8)}... has been expelled.`);
            }
            return;
          }

          // Handle explicit leaving
          if (innerPayload.type === "leave") {
            const leaver = actor;
            const ts = innerPayload.created_at || event.created_at;
            applyControlEvent(createMembershipControlEventBase({
              eventType: "COMMUNITY_MEMBER_LEFT",
              logicalEventId: event.id,
              createdAtUnixMs: ts,
              subjectPublicKeyHex: leaver,
            }));
            return;
          }

          // Handle explicit joining (from NIP-17 invites)
          if (innerPayload.type === "join") {
            const joiner = actor;
            const ts = innerPayload.created_at || event.created_at;
            applyControlEvent(createMembershipControlEventBase({
              eventType: "COMMUNITY_MEMBER_JOINED",
              logicalEventId: event.id,
              createdAtUnixMs: ts,
              subjectPublicKeyHex: joiner,
            }));
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
          setState((prev: Nip29GroupState): Nip29GroupState => ({
            ...prev,
            messages: prev.messages.filter((m) => !deletedIds.includes(m.id)),
          }));
        }
        return;
      }

      if (event.kind === GROUP_KIND_METADATA) {
        try {
          const metadata = JSON.parse(event.content);
          setState(prev => ({
            ...prev,
            metadata: { ...prev.metadata, ...metadata, id: params.groupId }
          }));
        } catch {
          // ignore invalid metadata JSON
        }
        return;
      }

      if (event.kind === GROUP_KIND_MEMBERS) {
        // Treat relay roster events as additive seeds only. A thinner roster snapshot
        // is not evidence that a peer actually left; explicit leave/expel/disband
        // events remain the canonical removal path.
        const rosterMembers = event.tags
          .filter(t => t[0] === 'p')
          .map(t => t[1] as PublicKeyHex)
          .filter(pk => !leftMembersRef.current.includes(pk) && !expelledMembersRef.current.includes(pk));
        if (
          localMembershipEvidenceRef.current
          && params.myPublicKeyHex
          && !rosterMembers.includes(params.myPublicKeyHex)
        ) {
          rosterMembers.push(params.myPublicKeyHex);
        }
        const rosterTimestamp = event.created_at;
        rosterMembers.forEach((pubkey) => {
          applyLedgerEvent({ type: "MEMBER_JOINED", pubkey, timestamp: rosterTimestamp });
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

      if (event.kind === GROUP_KIND_LEAVE) {
        const leaveTimestamp = event.created_at;
        const leavingPubkey = event.pubkey as PublicKeyHex;
        applyLedgerEvent({ type: "MEMBER_LEFT", pubkey: leavingPubkey, timestamp: leaveTimestamp });
        return;
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

    const timelineSubId = params.pool.subscribe([{
      kinds: [
        GROUP_KIND_SEALED,
        GROUP_KIND_DELETE,
        GROUP_KIND_METADATA,
        GROUP_KIND_MEMBERS,
        GROUP_KIND_REQUEST_JOIN,
        GROUP_KIND_LEAVE,
      ],
      "#h": [params.groupId],
      limit: 100
    }], onEvent);

    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "ready" }));
    });

    return (): void => {
      params.pool.unsubscribe(timelineSubId);
    };
  }, [params.groupId, params.pool, params.relayUrl, params.enabled, queueRealtimeMessage, applyLedgerEvent, params.myPublicKeyHex, conversationId, logRejectedEvent]);

  const refresh = useCallback((): void => {
    // Refresh logic here if needed
  }, []);

  const publishToCommunityScope = useCallback(async (event: NostrEvent): Promise<MultiRelayPublishResult> => {
    const payload = JSON.stringify(["EVENT", event]);
    const scopedRelayUrl = toScopedRelayUrl(params.relayUrl);
    if (!scopedRelayUrl) {
      return params.pool.publishToAll(payload);
    }

    if (typeof params.pool.publishToUrls === "function") {
      return params.pool.publishToUrls([scopedRelayUrl], payload);
    }
    if (typeof params.pool.publishToUrl === "function") {
      const result = await params.pool.publishToUrl(scopedRelayUrl, payload);
      return {
        success: result.success,
        successCount: result.success ? 1 : 0,
        totalRelays: 1,
        results: [result],
        overallError: result.success ? undefined : (result.error ?? "Scoped publish failed")
      };
    }
    if (typeof params.pool.publishToRelay === "function") {
      const result = await params.pool.publishToRelay(scopedRelayUrl, payload);
      return {
        success: result.success,
        successCount: result.success ? 1 : 0,
        totalRelays: 1,
        results: [result],
        overallError: result.success ? undefined : (result.error ?? "Scoped publish failed")
      };
    }
    return params.pool.publishToAll(payload);
  }, [params.pool, params.relayUrl]);

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
      if (!publishResult.success) {
        throw new Error(publishResult.overallError || "Failed to publish to community relay scope");
      }

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
    } catch (e: any) {
      toast.error(e.message || "Failed to send message. Check relay connection and try again.");
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
      if (!publishResult.success) {
        throw new Error(publishResult.overallError || "Failed to publish to community relay scope");
      }
      toast.success("Vote to kick published");
    } catch (e: any) {
      toast.error(e.message || "Failed to publish vote. Retry after relay reconnect.");
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

        const inviteEvent = await groupService.distributeRoomKey({
          recipientPubkey: memberPk,
          groupId: params.groupId,
          roomKeyHex: newKey,
          metadata: currentMetadata,
          relayUrl: params.relayUrl,
          communityId: params.communityId
        });
        await params.pool.publishToAll(JSON.stringify(["EVENT", inviteEvent]));
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
        if (!nip29LeaveResult.success) {
          throw new Error(nip29LeaveResult.overallError || "Failed to publish leave event");
        }

        // 2. Tell other CLIENTS via sealed channel (Kind 10105)
        if (roomKeyHex) {
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
            throw new Error(sealedLeaveResult.overallError || "Failed to publish sealed leave event");
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
        toast.error(e?.message || "Failed to leave via scoped relay. Try again or check relay status.");
      }
    }
    await roomKeyStore.deleteRoomKey(params.groupId);
    toast.success(disbandPublished ? "Community disbanded" : "Disconnected from community");
  }, [applyLedgerEvent, params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScopeWithRetry]);

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
      throw new Error(deletionResult.overallError || "Failed to publish delete to community relay scope");
    }
    deletedMessageTombstonesRef.current.set(deleteParams.eventId, Date.now());
    messageBus.emitMessageDeleted(conversationId, deleteParams.eventId);
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter(m => m.id !== deleteParams.eventId)
    }));
  }, [conversationId, params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScope]);

  const noop = async () => { };
  const updateMetadata = noop;
  const setGroupStatus = noop;
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
      if (!joinResult.success) {
        throw new Error(joinResult.overallError || "Failed to publish join request to community relay scope");
      }
      if (joinRequestPendingKey) {
        setJoinRequestStorageState(joinRequestPendingKey, { state: "pending" });
      }
      setState((prev) => ({ ...prev, joinRequestState: "pending", joinRequestBlockReason: undefined }));
      toast.success("Join request sent to relay");
    } catch (e: any) {
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
          : (e.message || "Failed to send join request. Confirm relay scope and retry.")
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
      requestJoin,
      approveJoin,
      denyJoin,
      approveAllJoinRequests,
      denyAllJoinRequests,
      sendMessage,
      sendVoteKick,
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
  }, [state, contentTimeline, refresh, requestJoin, approveJoin, denyJoin, approveAllJoinRequests, denyAllJoinRequests, sendMessage, sendVoteKick, rotateRoomKey, updateMetadata, setGroupStatus, putUser, removeUser, promoteUser, demoteUser, leaveGroup, deleteMessage, members]);

  return result;
};
