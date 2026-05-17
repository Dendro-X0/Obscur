"use client";

import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type AccountSyncMutationReason =
  | "requests_inbox_status_changed"
  | "peer_trust_changed"
  | "chat_state_changed"
  | "dm_history_changed"
  | "message_delete_tombstones_changed"
  | "identity_unlock_changed"
  | "community_membership_changed";

export type AccountSyncMutationDetail = Readonly<{
  reason: AccountSyncMutationReason;
  atUnixMs: number;
  profileId: string;
}>;

export type AccountSyncMutationEmitOptions = Readonly<{
  profileId?: string;
}>;

export type AccountSyncMutationSubscribeOptions = Readonly<{
  profileId?: string;
  /** When true, late subscribers receive the cached latest mutation (opt-in; default false to avoid render loops). */
  replayOnSubscribe?: boolean;
}>;

const ACCOUNT_SYNC_MUTATION_EVENT = "obscur.account_sync.private_state_mutated";
let latestMutationDetail: AccountSyncMutationDetail | null = null;
const latestMutationByProfile = new Map<string, AccountSyncMutationDetail>();

const resolveMutationProfileId = (explicit?: string): string => {
  const trimmed = explicit?.trim();
  if (trimmed) {
    return trimmed;
  }
  try {
    return getResolvedProfileId().trim();
  } catch {
    return "";
  }
};

const toMutationDetail = (value: unknown): AccountSyncMutationDetail | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.reason !== "requests_inbox_status_changed"
    && record.reason !== "peer_trust_changed"
    && record.reason !== "chat_state_changed"
    && record.reason !== "dm_history_changed"
    && record.reason !== "message_delete_tombstones_changed"
    && record.reason !== "identity_unlock_changed"
    && record.reason !== "community_membership_changed"
  ) {
    return null;
  }
  const atUnixMs = typeof record.atUnixMs === "number" && Number.isFinite(record.atUnixMs)
    ? record.atUnixMs
    : Date.now();
  const profileId = typeof record.profileId === "string" ? record.profileId.trim() : "";
  return {
    reason: record.reason,
    atUnixMs,
    profileId,
  };
};

const shouldDeliverMutationToSubscriber = (
  detail: AccountSyncMutationDetail,
  subscriberProfileId: string,
): boolean => {
  if (!subscriberProfileId) {
    return true;
  }
  if (!detail.profileId) {
    return false;
  }
  return detail.profileId === subscriberProfileId;
};

const rememberLatestMutation = (detail: AccountSyncMutationDetail): void => {
  latestMutationDetail = detail;
  if (detail.profileId) {
    latestMutationByProfile.set(detail.profileId, detail);
  }
};

export const emitAccountSyncMutation = (
  reason: AccountSyncMutationReason,
  options?: AccountSyncMutationEmitOptions,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const detail: AccountSyncMutationDetail = {
    reason,
    atUnixMs: Date.now(),
    profileId: resolveMutationProfileId(options?.profileId),
  };
  rememberLatestMutation(detail);
  window.dispatchEvent(new CustomEvent<AccountSyncMutationDetail>(ACCOUNT_SYNC_MUTATION_EVENT, {
    detail,
  }));
};

export const subscribeAccountSyncMutation = (
  listener: (detail: AccountSyncMutationDetail) => void,
  options?: AccountSyncMutationSubscribeOptions,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const filterProfileId = options?.profileId?.trim() ?? "";
  const replayOnSubscribe = options?.replayOnSubscribe === true;
  const onEvent = (event: Event): void => {
    const detail = toMutationDetail((event as CustomEvent<AccountSyncMutationDetail>).detail);
    if (!detail) {
      return;
    }
    rememberLatestMutation(detail);
    if (!shouldDeliverMutationToSubscriber(detail, filterProfileId)) {
      return;
    }
    listener(detail);
  };
  window.addEventListener(ACCOUNT_SYNC_MUTATION_EVENT, onEvent as EventListener);
  if (replayOnSubscribe) {
    const replayDetail = filterProfileId
      ? latestMutationByProfile.get(filterProfileId) ?? null
      : latestMutationDetail;
    if (replayDetail && shouldDeliverMutationToSubscriber(replayDetail, filterProfileId)) {
      listener(replayDetail);
    }
  }
  return () => {
    window.removeEventListener(ACCOUNT_SYNC_MUTATION_EVENT, onEvent as EventListener);
  };
};

export const accountSyncMutationSignalInternals = {
  ACCOUNT_SYNC_MUTATION_EVENT,
  toMutationDetail,
  getLatestMutationDetail: (): AccountSyncMutationDetail | null => latestMutationDetail,
  getLatestMutationDetailForProfile: (profileId: string): AccountSyncMutationDetail | null => (
    latestMutationByProfile.get(profileId.trim()) ?? null
  ),
  clearLatestMutationCacheForTests: (): void => {
    latestMutationDetail = null;
    latestMutationByProfile.clear();
  },
};
