import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";
import { communityMembershipScopeMatches } from "./community-membership-scope-key";

// ---------------------------------------------------------------------------
// M3: Community Leave Outbox
//
// Durable private leave intent storage. The outbox record is written BEFORE
// any relay publish attempt so that a relay failure or rate-limit never rolls
// back the user's explicit decision to leave a community.
//
// Flow:
//   1. User triggers leave.
//   2. Ledger entry status → "left" (AB-05 guarantee, already in place).
//   3. Outbox item created with status "pending".
//   4. Relay publish attempted.
//      - success → outbox item removed (or marked "published").
//      - rate_limited → outbox item status → "rate_limited", retryAfterUnixMs set.
//      - rejected → outbox item status → "rejected" with reasonCode.
//   5. On next window open / background retry, pending/rate_limited items are
//      re-attempted. The local ledger "left" is authoritative regardless.
// ---------------------------------------------------------------------------

const LEAVE_OUTBOX_STORAGE_PREFIX = "obscur.group.leave_outbox.v1";

export type CommunityLeavePublishStatus =
  | "pending"
  | "published"
  | "rate_limited"
  | "rejected"
  | "retrying";

export type CommunityLeaveOutboxItem = Readonly<{
  id: string;
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  intentUnixMs: number;
  status: CommunityLeavePublishStatus;
  attemptCount: number;
  lastAttemptUnixMs?: number;
  retryAfterUnixMs?: number;
  rejectedReasonCode?: string;
}>;

type MutableOutboxItem = {
  -readonly [K in keyof CommunityLeaveOutboxItem]: CommunityLeaveOutboxItem[K];
};

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const toOutboxStorageKey = (publicKeyHex: string, profileId?: string): string =>
  getScopedStorageKey(
    `${LEAVE_OUTBOX_STORAGE_PREFIX}.${publicKeyHex}`,
    profileId ?? getResolvedProfileId(),
  );

// ---------------------------------------------------------------------------
// Parse / serialize
// ---------------------------------------------------------------------------

const isValidOutboxItem = (value: unknown): value is CommunityLeaveOutboxItem => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.publicKeyHex === "string" &&
    typeof v.groupId === "string" &&
    typeof v.relayUrl === "string" &&
    typeof v.intentUnixMs === "number" &&
    typeof v.status === "string" &&
    typeof v.attemptCount === "number"
  );
};

const parseOutboxSnapshot = (raw: unknown): CommunityLeaveOutboxItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidOutboxItem);
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const isTerminalLeaveOutboxStatus = (status: CommunityLeavePublishStatus): boolean => (
  status === "published" || status === "rejected"
);

export const readCommunityLeaveOutbox = (
  publicKeyHex: string,
  profileId?: string,
): ReadonlyArray<CommunityLeaveOutboxItem> => {
  try {
    const raw = window.localStorage.getItem(toOutboxStorageKey(publicKeyHex, profileId));
    if (!raw) return [];
    const parsed = parseOutboxSnapshot(JSON.parse(raw));
    const retained = parsed.filter((item) => !isTerminalLeaveOutboxStatus(item.status));
    if (retained.length !== parsed.length) {
      saveCommunityLeaveOutbox(publicKeyHex, retained, profileId);
    }
    return retained;
  } catch {
    return [];
  }
};

const saveCommunityLeaveOutbox = (
  publicKeyHex: string,
  items: ReadonlyArray<CommunityLeaveOutboxItem>,
  profileId?: string,
): void => {
  try {
    window.localStorage.setItem(
      toOutboxStorageKey(publicKeyHex, profileId),
      JSON.stringify(items),
    );
  } catch {
    // best effort
  }
};

export const enqueueCommunityLeaveOutboxItem = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  intentUnixMs?: number;
  profileId?: string;
}>): CommunityLeaveOutboxItem => {
  const existing = readCommunityLeaveOutbox(params.publicKeyHex, params.profileId);
  const id = toCommunityLeaveOutboxItemId(params.groupId, params.relayUrl);

  const item: CommunityLeaveOutboxItem = {
    id,
    publicKeyHex: params.publicKeyHex,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    communityId: params.communityId,
    intentUnixMs: params.intentUnixMs ?? Date.now(),
    status: "pending",
    attemptCount: 0,
  };

  const dedupedExisting = existing.filter((e) => e.id !== id);
  saveCommunityLeaveOutbox(params.publicKeyHex, [...dedupedExisting, item], params.profileId);

  logAppEvent({
    name: "groups.leave_outbox_enqueued",
    level: "info",
    scope: { feature: "groups", action: "leave_outbox" },
    context: {
      groupId: params.groupId,
      relayUrl: params.relayUrl,
      intentUnixMs: item.intentUnixMs,
    },
  });

  return item;
};

export type CommunityLeavePublishOutcome = Readonly<{
  status: CommunityLeavePublishStatus;
  retryAfterUnixMs?: number;
  rejectedReasonCode?: string;
}>;

export const updateCommunityLeaveOutboxItem = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  outcome: CommunityLeavePublishOutcome;
  nowUnixMs?: number;
  profileId?: string;
}>): void => {
  const existing = readCommunityLeaveOutbox(params.publicKeyHex, params.profileId);
  const id = toCommunityLeaveOutboxItemId(params.groupId, params.relayUrl);
  const now = params.nowUnixMs ?? Date.now();

  const updated = existing.map((item): CommunityLeaveOutboxItem => {
    if (item.id !== id) return item;
    const next: MutableOutboxItem = {
      ...item,
      status: params.outcome.status,
      attemptCount: item.attemptCount + 1,
      lastAttemptUnixMs: now,
    };
    if (params.outcome.retryAfterUnixMs !== undefined) {
      next.retryAfterUnixMs = params.outcome.retryAfterUnixMs;
    }
    if (params.outcome.rejectedReasonCode !== undefined) {
      next.rejectedReasonCode = params.outcome.rejectedReasonCode;
    }
    return next;
  });

  // Terminal relay outcomes are not surfaced in UI — drop published and rejected rows.
  const retained = updated.filter((item) => (
    item.id !== id || !isTerminalLeaveOutboxStatus(item.status)
  ));

  saveCommunityLeaveOutbox(params.publicKeyHex, retained, params.profileId);

  logAppEvent({
    name: "groups.leave_outbox_updated",
    level: params.outcome.status === "rejected" ? "warn" : "info",
    scope: { feature: "groups", action: "leave_outbox" },
    context: {
      groupId: params.groupId,
      relayUrl: params.relayUrl,
      status: params.outcome.status,
      retryAfterUnixMs: params.outcome.retryAfterUnixMs ?? null,
      rejectedReasonCode: params.outcome.rejectedReasonCode ?? null,
    },
  });
};

export const removeCommunityLeaveOutboxItem = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): void => {
  const scope = { groupId: params.groupId, relayUrl: params.relayUrl };
  const existing = readCommunityLeaveOutbox(params.publicKeyHex, params.profileId);
  saveCommunityLeaveOutbox(
    params.publicKeyHex,
    existing.filter((item) => !communityMembershipScopeMatches(scope, {
      groupId: item.groupId,
      relayUrl: item.relayUrl,
    })),
    params.profileId,
  );
};

export const toCommunityLeaveOutboxItemId = (
  groupId: string,
  relayUrl: string,
): string => `${groupId}@@${relayUrl}`;

export const findCommunityLeaveOutboxItem = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  profileId?: string;
}>): CommunityLeaveOutboxItem | null => {
  const id = toCommunityLeaveOutboxItemId(params.groupId, params.relayUrl);
  return readCommunityLeaveOutbox(params.publicKeyHex, params.profileId).find((item) => item.id === id) ?? null;
};

/** Items still awaiting relay confirmation (pending, retrying, or rate_limited). */
export const listCommunityLeaveOutboxItemsAwaitingRelay = (
  publicKeyHex: string,
  profileId?: string,
): ReadonlyArray<CommunityLeaveOutboxItem> => (
  readCommunityLeaveOutbox(publicKeyHex, profileId).filter((item) => !isTerminalLeaveOutboxStatus(item.status))
);

export const getPendingCommunityLeaveOutboxItems = (
  publicKeyHex: string,
  nowUnixMs?: number,
  profileId?: string,
): ReadonlyArray<CommunityLeaveOutboxItem> => {
  const now = nowUnixMs ?? Date.now();
  return readCommunityLeaveOutbox(publicKeyHex, profileId).filter((item) => {
    if (item.status === "published" || item.status === "rejected") return false;
    if (item.status === "rate_limited") {
      return item.retryAfterUnixMs !== undefined && now >= item.retryAfterUnixMs;
    }
    return true;
  });
};

// ---------------------------------------------------------------------------
// Rate-limit classification helper
// ---------------------------------------------------------------------------

export type LeavePublishRateLimitClassification = Readonly<{
  isRateLimited: boolean;
  retryAfterUnixMs?: number;
}>;

const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /too many requests/i,
  /429/,
  /slow down/i,
  /throttl/i,
];

const DEFAULT_RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

/** Record relay publish result for an enqueued leave intent (does not mutate ledger). */
export const recordCommunityLeaveRelayPublishOutcome = (params: Readonly<{
  publicKeyHex: string;
  groupId: string;
  relayUrl: string;
  success: boolean;
  errorMessage?: string;
  profileId?: string;
}>): void => {
  if (params.success) {
    updateCommunityLeaveOutboxItem({
      publicKeyHex: params.publicKeyHex,
      groupId: params.groupId,
      relayUrl: params.relayUrl,
      outcome: { status: "published" },
      profileId: params.profileId,
    });
    return;
  }
  const classification = classifyLeavePublishFailure(params.errorMessage);
  updateCommunityLeaveOutboxItem({
    publicKeyHex: params.publicKeyHex,
    groupId: params.groupId,
    relayUrl: params.relayUrl,
    outcome: classification.isRateLimited
      ? {
          status: "rate_limited",
          retryAfterUnixMs: classification.retryAfterUnixMs,
        }
      : {
          status: "rejected",
          rejectedReasonCode: params.errorMessage?.slice(0, 120) ?? "publish_failed",
        },
    profileId: params.profileId,
  });
};

export const classifyLeavePublishFailure = (
  errorMessage: string | null | undefined,
  nowUnixMs?: number,
): LeavePublishRateLimitClassification => {
  const now = nowUnixMs ?? Date.now();
  const msg = errorMessage ?? "";
  const isRateLimited = RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(msg));
  return {
    isRateLimited,
    retryAfterUnixMs: isRateLimited ? now + DEFAULT_RATE_LIMIT_BACKOFF_MS : undefined,
  };
};
