import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "@/app/features/crypto/crypto-interfaces";

export const PRESENCE_EVENT_KIND = 30315;
export const PRESENCE_D_TAG = "obscur.presence.v1";
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 25_000;
export const PRESENCE_STALE_AFTER_MS = 75_000;

export type PresenceState = "online" | "offline";

export type PresencePayload = Readonly<{
  type: "obscur_presence";
  version: 1;
  state: PresenceState;
  sessionId: string;
  startedAtMs: number;
  issuedAtMs: number;
}>;

export type PresenceRecord = Readonly<{
  pubkey: PublicKeyHex;
  state: PresenceState;
  sessionId: string;
  startedAtMs: number;
  issuedAtMs: number;
  eventCreatedAtMs: number;
}>;

const isPresenceState = (value: unknown): value is PresenceState => (
  value === "online" || value === "offline"
);

const hasPresenceDTag = (tags: ReadonlyArray<ReadonlyArray<string>>): boolean => (
  tags.some((tag) => tag[0] === "d" && tag[1] === PRESENCE_D_TAG)
);

export const buildPresenceUnsignedEvent = (params: Readonly<{
  pubkey: PublicKeyHex;
  state: PresenceState;
  sessionId: string;
  startedAtMs: number;
  issuedAtMs?: number;
}>): UnsignedNostrEvent => {
  const issuedAtMs = params.issuedAtMs ?? Date.now();
  const payload: PresencePayload = {
    type: "obscur_presence",
    version: 1,
    state: params.state,
    sessionId: params.sessionId,
    startedAtMs: params.startedAtMs,
    issuedAtMs,
  };
  return {
    kind: PRESENCE_EVENT_KIND,
    pubkey: params.pubkey,
    created_at: Math.floor(issuedAtMs / 1000),
    tags: [
      ["d", PRESENCE_D_TAG],
      ["t", "presence"],
      ["state", params.state],
      ["app", "obscur"],
    ],
    content: JSON.stringify(payload),
  };
};

export const parsePresenceEvent = (event: NostrEvent): PresenceRecord | null => {
  if (event.kind !== PRESENCE_EVENT_KIND) {
    return null;
  }
  if (!Array.isArray(event.tags) || !hasPresenceDTag(event.tags)) {
    return null;
  }
  let parsed: Partial<PresencePayload> = {};
  try {
    const candidate = JSON.parse(event.content) as Partial<PresencePayload>;
    if (candidate && typeof candidate === "object") {
      parsed = candidate;
    }
  } catch {
    parsed = {};
  }
  const stateTag = event.tags.find((tag) => tag[0] === "state")?.[1];
  const resolvedState = isPresenceState(parsed.state) ? parsed.state : (isPresenceState(stateTag) ? stateTag : null);
  if (!resolvedState) {
    return null;
  }
  const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId.trim() : "";
  if (sessionId.length === 0) {
    return null;
  }
  const startedAtMs = typeof parsed.startedAtMs === "number" && Number.isFinite(parsed.startedAtMs)
    ? parsed.startedAtMs
    : event.created_at * 1000;
  const issuedAtMs = typeof parsed.issuedAtMs === "number" && Number.isFinite(parsed.issuedAtMs)
    ? parsed.issuedAtMs
    : event.created_at * 1000;
  return {
    pubkey: event.pubkey as PublicKeyHex,
    state: resolvedState,
    sessionId,
    startedAtMs,
    issuedAtMs,
    eventCreatedAtMs: event.created_at * 1000,
  };
};

export const isPresenceRecordOnline = (
  record: PresenceRecord | null | undefined,
  nowMs: number,
  staleAfterMs: number = PRESENCE_STALE_AFTER_MS
): boolean => {
  if (!record) return false;
  if (record.state !== "online") return false;
  return (nowMs - record.eventCreatedAtMs) <= staleAfterMs;
};

export const shouldRejectSessionAsDuplicate = (params: Readonly<{
  incoming: PresenceRecord;
  selfPublicKeyHex: PublicKeyHex;
  selfSessionId: string;
  selfStartedAtMs: number;
  nowMs: number;
  staleAfterMs?: number;
}>): boolean => {
  if (params.incoming.pubkey !== params.selfPublicKeyHex) {
    return false;
  }
  if (params.incoming.sessionId === params.selfSessionId) {
    return false;
  }
  if (!isPresenceRecordOnline(params.incoming, params.nowMs, params.staleAfterMs)) {
    return false;
  }
  // Ignore historical self-session records that were created before this runtime started.
  // They are replay evidence, not proof that another session is currently active.
  if (params.incoming.eventCreatedAtMs < params.selfStartedAtMs) {
    return false;
  }
  if (params.incoming.startedAtMs < params.selfStartedAtMs) {
    return true;
  }
  if (params.incoming.startedAtMs > params.selfStartedAtMs) {
    return false;
  }
  return params.incoming.sessionId < params.selfSessionId;
};
