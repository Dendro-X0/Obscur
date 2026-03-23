import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type IncomingRequestAntiAbuseDecisionCode =
  | "allowed"
  | "peer_rate_limited"
  | "peer_cooldown_active"
  | "global_rate_limited";

export type IncomingRequestAntiAbuseDecision = Readonly<{
  allowed: boolean;
  reasonCode: IncomingRequestAntiAbuseDecisionCode;
  peerWindowCount: number;
  globalWindowCount: number;
  peerLimit: number;
  globalLimit: number;
  windowMs: number;
  peerCooldownMs: number;
  cooldownRemainingMs: number | null;
}>;

type IncomingRequestAntiAbuseState = Readonly<{
  globalEventUnixMs: ReadonlyArray<number>;
  peerEventUnixMsByPeer: ReadonlyMap<PublicKeyHex, ReadonlyArray<number>>;
  peerCooldownUntilUnixMsByPeer: ReadonlyMap<PublicKeyHex, number>;
}>;

const GLOBAL_STATE_KEY = "__obscur_incoming_request_anti_abuse_state__";
const WINDOW_MS = 2 * 60 * 1000;
const PEER_COOLDOWN_MS = 2 * 60 * 1000;
const PEER_LIMIT = 3;
const GLOBAL_LIMIT = 20;

const createDefaultState = (): IncomingRequestAntiAbuseState => ({
  globalEventUnixMs: [],
  peerEventUnixMsByPeer: new Map<PublicKeyHex, ReadonlyArray<number>>(),
  peerCooldownUntilUnixMsByPeer: new Map<PublicKeyHex, number>(),
});

const getState = (): IncomingRequestAntiAbuseState => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing as IncomingRequestAntiAbuseState;
  }
  const created = createDefaultState();
  root[GLOBAL_STATE_KEY] = created;
  return created;
};

const setState = (next: IncomingRequestAntiAbuseState): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_STATE_KEY] = next;
};

const pruneEventWindow = (eventUnixMs: ReadonlyArray<number>, nowUnixMs: number): ReadonlyArray<number> => (
  eventUnixMs.filter((value) => nowUnixMs - value <= WINDOW_MS)
);

const pruneCooldownMap = (
  cooldownMap: ReadonlyMap<PublicKeyHex, number>,
  nowUnixMs: number,
): ReadonlyMap<PublicKeyHex, number> => {
  const next = new Map<PublicKeyHex, number>();
  cooldownMap.forEach((cooldownUntilUnixMs, peerPublicKeyHex) => {
    if (cooldownUntilUnixMs > nowUnixMs) {
      next.set(peerPublicKeyHex, cooldownUntilUnixMs);
    }
  });
  return next;
};

const withRecordedEvent = (
  state: IncomingRequestAntiAbuseState,
  peerPublicKeyHex: PublicKeyHex,
  nowUnixMs: number,
): IncomingRequestAntiAbuseState => {
  const prunedGlobal = pruneEventWindow(state.globalEventUnixMs, nowUnixMs);
  const prunedPeer = pruneEventWindow(state.peerEventUnixMsByPeer.get(peerPublicKeyHex) ?? [], nowUnixMs);
  const nextPeerMap = new Map<PublicKeyHex, ReadonlyArray<number>>(state.peerEventUnixMsByPeer);
  const nextCooldownMap = new Map<PublicKeyHex, number>(
    pruneCooldownMap(state.peerCooldownUntilUnixMsByPeer, nowUnixMs),
  );
  nextCooldownMap.delete(peerPublicKeyHex);
  nextPeerMap.set(peerPublicKeyHex, [...prunedPeer, nowUnixMs]);
  return {
    globalEventUnixMs: [...prunedGlobal, nowUnixMs],
    peerEventUnixMsByPeer: nextPeerMap,
    peerCooldownUntilUnixMsByPeer: nextCooldownMap,
  };
};

const withPeerCooldown = (
  state: IncomingRequestAntiAbuseState,
  peerPublicKeyHex: PublicKeyHex,
  nowUnixMs: number,
): IncomingRequestAntiAbuseState => {
  const nextCooldownMap = new Map<PublicKeyHex, number>(
    pruneCooldownMap(state.peerCooldownUntilUnixMsByPeer, nowUnixMs),
  );
  nextCooldownMap.set(peerPublicKeyHex, nowUnixMs + PEER_COOLDOWN_MS);
  return {
    globalEventUnixMs: pruneEventWindow(state.globalEventUnixMs, nowUnixMs),
    peerEventUnixMsByPeer: state.peerEventUnixMsByPeer,
    peerCooldownUntilUnixMsByPeer: nextCooldownMap,
  };
};

export const evaluateIncomingRequestAntiAbuse = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  nowUnixMs?: number;
}>): IncomingRequestAntiAbuseDecision => {
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const rawState = getState();
  const state: IncomingRequestAntiAbuseState = {
    globalEventUnixMs: pruneEventWindow(rawState.globalEventUnixMs, nowUnixMs),
    peerEventUnixMsByPeer: rawState.peerEventUnixMsByPeer,
    peerCooldownUntilUnixMsByPeer: pruneCooldownMap(rawState.peerCooldownUntilUnixMsByPeer, nowUnixMs),
  };
  setState(state);

  const activeCooldownUntilUnixMs = state.peerCooldownUntilUnixMsByPeer.get(params.peerPublicKeyHex) ?? null;
  if (typeof activeCooldownUntilUnixMs === "number" && activeCooldownUntilUnixMs > nowUnixMs) {
    return {
      allowed: false,
      reasonCode: "peer_cooldown_active",
      peerWindowCount: pruneEventWindow(
        state.peerEventUnixMsByPeer.get(params.peerPublicKeyHex) ?? [],
        nowUnixMs,
      ).length,
      globalWindowCount: state.globalEventUnixMs.length,
      peerLimit: PEER_LIMIT,
      globalLimit: GLOBAL_LIMIT,
      windowMs: WINDOW_MS,
      peerCooldownMs: PEER_COOLDOWN_MS,
      cooldownRemainingMs: Math.max(0, activeCooldownUntilUnixMs - nowUnixMs),
    };
  }

  const peerWindowCount = pruneEventWindow(
    state.peerEventUnixMsByPeer.get(params.peerPublicKeyHex) ?? [],
    nowUnixMs,
  ).length + 1;
  if (peerWindowCount > PEER_LIMIT) {
    setState(withPeerCooldown(state, params.peerPublicKeyHex, nowUnixMs));
    return {
      allowed: false,
      reasonCode: "peer_rate_limited",
      peerWindowCount,
      globalWindowCount: state.globalEventUnixMs.length,
      peerLimit: PEER_LIMIT,
      globalLimit: GLOBAL_LIMIT,
      windowMs: WINDOW_MS,
      peerCooldownMs: PEER_COOLDOWN_MS,
      cooldownRemainingMs: PEER_COOLDOWN_MS,
    };
  }

  const globalWindowCount = state.globalEventUnixMs.length + 1;
  if (globalWindowCount > GLOBAL_LIMIT) {
    return {
      allowed: false,
      reasonCode: "global_rate_limited",
      peerWindowCount,
      globalWindowCount,
      peerLimit: PEER_LIMIT,
      globalLimit: GLOBAL_LIMIT,
      windowMs: WINDOW_MS,
      peerCooldownMs: PEER_COOLDOWN_MS,
      cooldownRemainingMs: null,
    };
  }

  setState(withRecordedEvent(state, params.peerPublicKeyHex, nowUnixMs));
  return {
    allowed: true,
    reasonCode: "allowed",
    peerWindowCount,
    globalWindowCount,
    peerLimit: PEER_LIMIT,
    globalLimit: GLOBAL_LIMIT,
    windowMs: WINDOW_MS,
    peerCooldownMs: PEER_COOLDOWN_MS,
    cooldownRemainingMs: null,
  };
};

export const resetIncomingRequestAntiAbuseState = (): void => {
  setState(createDefaultState());
};

export const incomingRequestAntiAbuseInternals = {
  WINDOW_MS,
  PEER_COOLDOWN_MS,
  PEER_LIMIT,
  GLOBAL_LIMIT,
};
