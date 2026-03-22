import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type IncomingRequestAntiAbuseDecisionCode =
  | "allowed"
  | "peer_rate_limited"
  | "global_rate_limited";

export type IncomingRequestAntiAbuseDecision = Readonly<{
  allowed: boolean;
  reasonCode: IncomingRequestAntiAbuseDecisionCode;
  peerWindowCount: number;
  globalWindowCount: number;
  peerLimit: number;
  globalLimit: number;
  windowMs: number;
}>;

type IncomingRequestAntiAbuseState = Readonly<{
  globalEventUnixMs: ReadonlyArray<number>;
  peerEventUnixMsByPeer: ReadonlyMap<PublicKeyHex, ReadonlyArray<number>>;
}>;

const GLOBAL_STATE_KEY = "__obscur_incoming_request_anti_abuse_state__";
const WINDOW_MS = 2 * 60 * 1000;
const PEER_LIMIT = 3;
const GLOBAL_LIMIT = 20;

const createDefaultState = (): IncomingRequestAntiAbuseState => ({
  globalEventUnixMs: [],
  peerEventUnixMsByPeer: new Map<PublicKeyHex, ReadonlyArray<number>>(),
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

const withRecordedEvent = (
  state: IncomingRequestAntiAbuseState,
  peerPublicKeyHex: PublicKeyHex,
  nowUnixMs: number,
): IncomingRequestAntiAbuseState => {
  const prunedGlobal = pruneEventWindow(state.globalEventUnixMs, nowUnixMs);
  const prunedPeer = pruneEventWindow(state.peerEventUnixMsByPeer.get(peerPublicKeyHex) ?? [], nowUnixMs);
  const nextPeerMap = new Map<PublicKeyHex, ReadonlyArray<number>>(state.peerEventUnixMsByPeer);
  nextPeerMap.set(peerPublicKeyHex, [...prunedPeer, nowUnixMs]);
  return {
    globalEventUnixMs: [...prunedGlobal, nowUnixMs],
    peerEventUnixMsByPeer: nextPeerMap,
  };
};

export const evaluateIncomingRequestAntiAbuse = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  nowUnixMs?: number;
}>): IncomingRequestAntiAbuseDecision => {
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const state = getState();

  const peerWindowCount = pruneEventWindow(
    state.peerEventUnixMsByPeer.get(params.peerPublicKeyHex) ?? [],
    nowUnixMs,
  ).length + 1;
  if (peerWindowCount > PEER_LIMIT) {
    return {
      allowed: false,
      reasonCode: "peer_rate_limited",
      peerWindowCount,
      globalWindowCount: pruneEventWindow(state.globalEventUnixMs, nowUnixMs).length,
      peerLimit: PEER_LIMIT,
      globalLimit: GLOBAL_LIMIT,
      windowMs: WINDOW_MS,
    };
  }

  const globalWindowCount = pruneEventWindow(state.globalEventUnixMs, nowUnixMs).length + 1;
  if (globalWindowCount > GLOBAL_LIMIT) {
    return {
      allowed: false,
      reasonCode: "global_rate_limited",
      peerWindowCount,
      globalWindowCount,
      peerLimit: PEER_LIMIT,
      globalLimit: GLOBAL_LIMIT,
      windowMs: WINDOW_MS,
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
  };
};

export const resetIncomingRequestAntiAbuseState = (): void => {
  setState(createDefaultState());
};
