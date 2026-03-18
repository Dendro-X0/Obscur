"use client";

export type AccountSyncMutationReason =
  | "requests_inbox_status_changed"
  | "peer_trust_changed"
  | "chat_state_changed"
  | "identity_unlock_changed"
  | "community_membership_changed";

type AccountSyncMutationDetail = Readonly<{
  reason: AccountSyncMutationReason;
  atUnixMs: number;
}>;

const ACCOUNT_SYNC_MUTATION_EVENT = "obscur.account_sync.private_state_mutated";
let latestMutationDetail: AccountSyncMutationDetail | null = null;

const toMutationDetail = (value: unknown): AccountSyncMutationDetail | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.reason !== "requests_inbox_status_changed"
    && record.reason !== "peer_trust_changed"
    && record.reason !== "chat_state_changed"
    && record.reason !== "identity_unlock_changed"
    && record.reason !== "community_membership_changed"
  ) {
    return null;
  }
  const atUnixMs = typeof record.atUnixMs === "number" && Number.isFinite(record.atUnixMs)
    ? record.atUnixMs
    : Date.now();
  return {
    reason: record.reason,
    atUnixMs,
  };
};

export const emitAccountSyncMutation = (reason: AccountSyncMutationReason): void => {
  if (typeof window === "undefined") {
    return;
  }
  const detail: AccountSyncMutationDetail = {
    reason,
    atUnixMs: Date.now(),
  };
  latestMutationDetail = detail;
  window.dispatchEvent(new CustomEvent<AccountSyncMutationDetail>(ACCOUNT_SYNC_MUTATION_EVENT, {
    detail,
  }));
};

export const subscribeAccountSyncMutation = (
  listener: (detail: AccountSyncMutationDetail) => void
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const onEvent = (event: Event): void => {
    const detail = toMutationDetail((event as CustomEvent<AccountSyncMutationDetail>).detail);
    if (!detail) {
      return;
    }
    latestMutationDetail = detail;
    listener(detail);
  };
  window.addEventListener(ACCOUNT_SYNC_MUTATION_EVENT, onEvent as EventListener);
  if (latestMutationDetail) {
    listener(latestMutationDetail);
  }
  return () => {
    window.removeEventListener(ACCOUNT_SYNC_MUTATION_EVENT, onEvent as EventListener);
  };
};

export const accountSyncMutationSignalInternals = {
  ACCOUNT_SYNC_MUTATION_EVENT,
  toMutationDetail,
  getLatestMutationDetail: (): AccountSyncMutationDetail | null => latestMutationDetail,
};
