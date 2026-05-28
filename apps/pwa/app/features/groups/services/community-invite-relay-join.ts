import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { CommunityDmInviteId } from "./community-dm-invite-contract";

const STORAGE_PREFIX = "obscur.community.invite_relay_join.v1";

/** Evidence-backed relay join outcome after DM accept (local join may already be durable). */
export type CommunityInviteRelayJoinStatus =
  | "not_attempted"
  | "joined"
  | "retry_scheduled"
  | "terminal_failed";

export type CommunityInviteRelayJoinState = Readonly<{
  status: CommunityInviteRelayJoinStatus;
  manualRetryCount: number;
  updatedAtUnixMs: number;
}>;

export type RelayScopedPublishFn = (payload: string) => Promise<boolean>;

const defaultState = (): CommunityInviteRelayJoinState => ({
  status: "not_attempted",
  manualRetryCount: 0,
  updatedAtUnixMs: Date.now(),
});

const storageKey = (inviteId: CommunityDmInviteId, profileId?: string): string => (
  getScopedStorageKey(`${STORAGE_PREFIX}:${inviteId}`, profileId ?? getResolvedProfileId())
);

export const loadInviteRelayJoinState = (
  inviteId: CommunityDmInviteId,
  profileId?: string,
): CommunityInviteRelayJoinState => {
  if (typeof window === "undefined") {
    return defaultState();
  }
  try {
    const raw = window.localStorage.getItem(storageKey(inviteId, profileId));
    if (!raw) {
      return defaultState();
    }
    const parsed = JSON.parse(raw) as Partial<CommunityInviteRelayJoinState>;
    const status = parsed.status;
    if (
      status !== "not_attempted"
      && status !== "joined"
      && status !== "retry_scheduled"
      && status !== "terminal_failed"
    ) {
      return defaultState();
    }
    return {
      status,
      manualRetryCount: typeof parsed.manualRetryCount === "number"
        ? Math.max(0, parsed.manualRetryCount)
        : 0,
      updatedAtUnixMs: typeof parsed.updatedAtUnixMs === "number"
        ? parsed.updatedAtUnixMs
        : Date.now(),
    };
  } catch {
    return defaultState();
  }
};

export const saveInviteRelayJoinState = (
  inviteId: CommunityDmInviteId,
  state: CommunityInviteRelayJoinState,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(inviteId, profileId), JSON.stringify(state));
  } catch {
    // ignore quota
  }
};

const publishEventWithRetry = async (params: Readonly<{
  publish: RelayScopedPublishFn;
  eventJson: string;
  maxAttempts?: number;
  baseBackoffMs?: number;
}>): Promise<boolean> => {
  const maxAttempts = Math.max(1, params.maxAttempts ?? 3);
  const baseBackoffMs = Math.max(50, params.baseBackoffMs ?? 250);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (await params.publish(params.eventJson)) {
        return true;
      }
    } catch {
      // transient
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => window.setTimeout(resolve, baseBackoffMs * attempt));
    }
  }
  return false;
};

export const publishCommunityInviteRelayJoin = async (params: Readonly<{
  publish: RelayScopedPublishFn;
  nip29JoinJson: string;
  sealedJoinJson: string;
  maxAttempts?: number;
  baseBackoffMs?: number;
}>): Promise<CommunityInviteRelayJoinStatus> => {
  const [nip29Ok, sealedOk] = await Promise.all([
    publishEventWithRetry({
      publish: params.publish,
      eventJson: params.nip29JoinJson,
      maxAttempts: params.maxAttempts,
      baseBackoffMs: params.baseBackoffMs,
    }),
    publishEventWithRetry({
      publish: params.publish,
      eventJson: params.sealedJoinJson,
      maxAttempts: params.maxAttempts,
      baseBackoffMs: params.baseBackoffMs,
    }),
  ]);
  return nip29Ok || sealedOk ? "joined" : "retry_scheduled";
};

export const resolveRelayJoinStatusAfterManualRetry = (
  publishSucceeded: boolean,
  previous: CommunityInviteRelayJoinState,
  maxManualRetries = 2,
): CommunityInviteRelayJoinState => {
  const manualRetryCount = previous.manualRetryCount + 1;
  if (publishSucceeded) {
    return {
      status: "joined",
      manualRetryCount,
      updatedAtUnixMs: Date.now(),
    };
  }
  if (manualRetryCount >= maxManualRetries) {
    return {
      status: "terminal_failed",
      manualRetryCount,
      updatedAtUnixMs: Date.now(),
    };
  }
  return {
    status: "retry_scheduled",
    manualRetryCount,
    updatedAtUnixMs: Date.now(),
  };
};

export const shouldShowInviteRelayJoinRetry = (
  inviteResolutionStatus: string,
  relayJoin: CommunityInviteRelayJoinState,
  isOutgoing: boolean,
): boolean => (
  !isOutgoing
  && inviteResolutionStatus === "accepted"
  && relayJoin.status === "retry_scheduled"
);
