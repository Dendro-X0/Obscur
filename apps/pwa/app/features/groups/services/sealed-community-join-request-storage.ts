import type { JoinRequestState } from "../types";
import type { JoinRequestBlockReason } from "../../messaging/types";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizeSealedCommunityRelayUrl } from "./sealed-community-relay-scope";

const JOIN_REQUEST_PENDING_PREFIX = "obscur:groups:join-request-pending:v1";
const JOIN_REQUEST_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
export const JOIN_REQUEST_COOLDOWN_MS = 2 * 60 * 1000;
const JOIN_REQUEST_DENIED_TTL_MS = 30 * 60 * 1000;

type JoinRequestStorageRecord = Readonly<{
  status: Exclude<JoinRequestState, "none" | "expired">;
  updatedAtMs: number;
  cooldownUntilMs?: number;
}>;

export const toJoinRequestPendingKey = (params: Readonly<{
  relayUrl: string;
  groupId: string;
  myPublicKeyHex: PublicKeyHex;
  profileId?: string;
}>): string => {
  const base = [
    JOIN_REQUEST_PENDING_PREFIX,
    params.myPublicKeyHex,
    normalizeSealedCommunityRelayUrl(params.relayUrl),
    params.groupId,
  ].join(":");
  return getScopedStorageKey(base, params.profileId ?? getResolvedProfileId());
};

export const getJoinRequestStorageState = (storageKey: string): Readonly<{
  state: JoinRequestState;
  remainingCooldownMs?: number;
}> => {
  if (typeof window === "undefined") {
    return { state: "none" };
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return { state: "none" };
  }
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

export const blockReasonFromJoinState = (state: JoinRequestState): JoinRequestBlockReason | undefined => {
  if (state === "pending") {
    return "pending_request_exists";
  }
  if (state === "cooldown") {
    return "cooldown_active";
  }
  if (state === "denied") {
    return "denied_request";
  }
  return undefined;
};

export const classifyJoinRequestFailure = (error: unknown): "denied" | "cooldown" => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/(denied|forbidden|not allowed|permission|not authorized|unauthorized|blocked)/i.test(message)) {
    return "denied";
  }
  return "cooldown";
};

export const setJoinRequestStorageState = (
  storageKey: string,
  params: Readonly<{ state: Exclude<JoinRequestState, "none" | "expired">; cooldownMs?: number }>,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const now = Date.now();
  const next: JoinRequestStorageRecord = params.state === "cooldown"
    ? {
      status: "cooldown",
      updatedAtMs: now,
      cooldownUntilMs: now + Math.max(1_000, params.cooldownMs ?? JOIN_REQUEST_COOLDOWN_MS),
    }
    : {
      status: params.state,
      updatedAtMs: now,
    };
  window.localStorage.setItem(storageKey, JSON.stringify(next));
};

export const clearJoinRequestPending = (storageKey: string | null): void => {
  if (!storageKey || typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(storageKey);
};
