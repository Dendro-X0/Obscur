import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  evaluateIncomingRequestAttackModeGate,
  evaluateSignedSharedIntelRelayRisk,
  getAttackModeSafetyProfile,
  type AttackModeGateReasonCode,
  type AttackModeSafetyProfile,
  type RelayRiskLevel,
  type SignedSharedIntelSignal,
  type SharedIntelSignatureVerifier,
} from "./m10-shared-intel-policy";

type IncomingRequestAntiAbuseDecisionCode =
  | "allowed"
  | "peer_rate_limited"
  | "peer_cooldown_active"
  | "global_rate_limited"
  | "attack_mode_strict_relay_high_risk"
  | "attack_mode_peer_shared_intel_blocked"
  | "attack_mode_contract_violation";

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
  attackModeSafetyProfile: AttackModeSafetyProfile;
  attackModeReasonCode: AttackModeGateReasonCode;
  relayRiskScore: number;
  relayRiskLevel: RelayRiskLevel;
  relayRiskReasonCode: string;
  sharedIntelMatchedSignalCount: number;
  sharedIntelIgnoredSignalCount: number;
}>;

type IncomingRequestAntiAbuseState = Readonly<{
  globalEventUnixMs: ReadonlyArray<number>;
  peerEventUnixMsByPeer: ReadonlyMap<PublicKeyHex, ReadonlyArray<number>>;
  peerCooldownUntilUnixMsByPeer: ReadonlyMap<PublicKeyHex, number>;
}>;

const PROFILE_STATE_CACHE_KEY = "__obscur_incoming_request_anti_abuse_state_by_profile__";
const STORAGE_KEY = "obscur.messaging.incoming_request_anti_abuse.v1";
const WINDOW_MS = 2 * 60 * 1000;
const PEER_COOLDOWN_MS = 2 * 60 * 1000;
const PEER_LIMIT = 3;
const GLOBAL_LIMIT = 20;

const createDefaultState = (): IncomingRequestAntiAbuseState => ({
  globalEventUnixMs: [],
  peerEventUnixMsByPeer: new Map<PublicKeyHex, ReadonlyArray<number>>(),
  peerCooldownUntilUnixMsByPeer: new Map<PublicKeyHex, number>(),
});

type PersistedIncomingRequestAntiAbuseState = Readonly<{
  version: "obscur.incoming_request_anti_abuse_state.v1";
  updatedAtUnixMs: number;
  globalEventUnixMs: ReadonlyArray<number>;
  peerEventUnixMsByPeer: Readonly<Record<string, ReadonlyArray<number>>>;
  peerCooldownUntilUnixMsByPeer: Readonly<Record<string, number>>;
}>;

const resolveProfileScope = (): string => getResolvedProfileId();

const getStorageKey = (): string => getScopedStorageKey(STORAGE_KEY, resolveProfileScope());

const getStateRoot = (): Map<string, IncomingRequestAntiAbuseState> => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[PROFILE_STATE_CACHE_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, IncomingRequestAntiAbuseState>;
  }
  const next = new Map<string, IncomingRequestAntiAbuseState>();
  root[PROFILE_STATE_CACHE_KEY] = next;
  return next;
};

const readPersistedState = (): IncomingRequestAntiAbuseState => {
  if (typeof window === "undefined") {
    return createDefaultState();
  }
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) {
      return createDefaultState();
    }
    const parsed = JSON.parse(raw) as Partial<PersistedIncomingRequestAntiAbuseState>;
    if (
      parsed.version !== "obscur.incoming_request_anti_abuse_state.v1"
      || !Array.isArray(parsed.globalEventUnixMs)
      || !parsed.peerEventUnixMsByPeer
      || typeof parsed.peerEventUnixMsByPeer !== "object"
      || !parsed.peerCooldownUntilUnixMsByPeer
      || typeof parsed.peerCooldownUntilUnixMsByPeer !== "object"
    ) {
      return createDefaultState();
    }
    const peerEventUnixMsByPeer = new Map<PublicKeyHex, ReadonlyArray<number>>();
    Object.entries(parsed.peerEventUnixMsByPeer).forEach(([key, value]) => {
      if (typeof key !== "string" || !Array.isArray(value)) {
        return;
      }
      peerEventUnixMsByPeer.set(
        key.toLowerCase() as PublicKeyHex,
        value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry)),
      );
    });
    const peerCooldownUntilUnixMsByPeer = new Map<PublicKeyHex, number>();
    Object.entries(parsed.peerCooldownUntilUnixMsByPeer).forEach(([key, value]) => {
      if (typeof key !== "string" || typeof value !== "number" || !Number.isFinite(value)) {
        return;
      }
      peerCooldownUntilUnixMsByPeer.set(key.toLowerCase() as PublicKeyHex, Math.floor(value));
    });
    return {
      globalEventUnixMs: parsed.globalEventUnixMs
        .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
        .map((entry) => Math.floor(entry)),
      peerEventUnixMsByPeer,
      peerCooldownUntilUnixMsByPeer,
    };
  } catch {
    return createDefaultState();
  }
};

const writePersistedState = (state: IncomingRequestAntiAbuseState): void => {
  if (typeof window === "undefined") {
    return;
  }
  const peerEventUnixMsByPeer: Record<string, ReadonlyArray<number>> = {};
  state.peerEventUnixMsByPeer.forEach((value, key) => {
    peerEventUnixMsByPeer[key] = value;
  });
  const peerCooldownUntilUnixMsByPeer: Record<string, number> = {};
  state.peerCooldownUntilUnixMsByPeer.forEach((value, key) => {
    peerCooldownUntilUnixMsByPeer[key] = value;
  });
  const payload: PersistedIncomingRequestAntiAbuseState = {
    version: "obscur.incoming_request_anti_abuse_state.v1",
    updatedAtUnixMs: Date.now(),
    globalEventUnixMs: state.globalEventUnixMs,
    peerEventUnixMsByPeer,
    peerCooldownUntilUnixMsByPeer,
  };
  window.localStorage.setItem(getStorageKey(), JSON.stringify(payload));
};

const getState = (): IncomingRequestAntiAbuseState => {
  const scope = resolveProfileScope();
  const root = getStateRoot();
  const existing = root.get(scope);
  if (existing) {
    return existing;
  }
  const loaded = readPersistedState();
  root.set(scope, loaded);
  return loaded;
};

const setState = (next: IncomingRequestAntiAbuseState): void => {
  const scope = resolveProfileScope();
  getStateRoot().set(scope, next);
  writePersistedState(next);
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
  relayUrl?: string | null;
  localRelayRiskScore?: number;
  attackModeSafetyProfile?: AttackModeSafetyProfile;
  sharedIntelSignals?: ReadonlyArray<SignedSharedIntelSignal>;
  sharedIntelSignatureVerifier?: SharedIntelSignatureVerifier | null;
}>): IncomingRequestAntiAbuseDecision => {
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const attackModeSafetyProfile = params.attackModeSafetyProfile ?? getAttackModeSafetyProfile();
  const relayRisk = evaluateSignedSharedIntelRelayRisk({
    relayUrl: params.relayUrl ?? null,
    peerPublicKeyHex: params.peerPublicKeyHex,
    localRelayRiskScore: params.localRelayRiskScore ?? 0,
    sharedIntelSignals: params.sharedIntelSignals,
    signatureVerifier: params.sharedIntelSignatureVerifier ?? undefined,
    nowUnixMs,
    payloadMetadata: {
      peerPublicKeyHex: params.peerPublicKeyHex,
      relayUrl: params.relayUrl ?? null,
      localRelayRiskScore: params.localRelayRiskScore ?? 0,
    },
  });
  const attackModeDecision = evaluateIncomingRequestAttackModeGate({
    safetyProfile: attackModeSafetyProfile,
    relayRiskLevel: relayRisk.relayRiskLevel,
    peerBlockedBySharedIntel: relayRisk.peerBlockedBySharedIntel,
    contractViolationDetected: relayRisk.contractViolationDetected,
  });
  const mapAttackModeReasonCode = (
    reasonCode: AttackModeGateReasonCode,
  ): IncomingRequestAntiAbuseDecisionCode => {
    if (reasonCode === "blocked_strict_mode_peer_shared_intel") {
      return "attack_mode_peer_shared_intel_blocked";
    }
    if (reasonCode === "blocked_strict_mode_contract_violation") {
      return "attack_mode_contract_violation";
    }
    if (reasonCode === "blocked_strict_mode_relay_high_risk") {
      return "attack_mode_strict_relay_high_risk";
    }
    return "allowed";
  };
  if (!attackModeDecision.allowed) {
    return {
      allowed: false,
      reasonCode: mapAttackModeReasonCode(attackModeDecision.reasonCode),
      peerWindowCount: 0,
      globalWindowCount: 0,
      peerLimit: PEER_LIMIT,
      globalLimit: GLOBAL_LIMIT,
      windowMs: WINDOW_MS,
      peerCooldownMs: PEER_COOLDOWN_MS,
      cooldownRemainingMs: null,
      attackModeSafetyProfile,
      attackModeReasonCode: attackModeDecision.reasonCode,
      relayRiskScore: relayRisk.relayRiskScore,
      relayRiskLevel: relayRisk.relayRiskLevel,
      relayRiskReasonCode: relayRisk.relayRiskReasonCode,
      sharedIntelMatchedSignalCount: relayRisk.matchedSignalCount,
      sharedIntelIgnoredSignalCount: relayRisk.ignoredSignalCount,
    };
  }
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
      attackModeSafetyProfile,
      attackModeReasonCode: attackModeDecision.reasonCode,
      relayRiskScore: relayRisk.relayRiskScore,
      relayRiskLevel: relayRisk.relayRiskLevel,
      relayRiskReasonCode: relayRisk.relayRiskReasonCode,
      sharedIntelMatchedSignalCount: relayRisk.matchedSignalCount,
      sharedIntelIgnoredSignalCount: relayRisk.ignoredSignalCount,
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
      attackModeSafetyProfile,
      attackModeReasonCode: attackModeDecision.reasonCode,
      relayRiskScore: relayRisk.relayRiskScore,
      relayRiskLevel: relayRisk.relayRiskLevel,
      relayRiskReasonCode: relayRisk.relayRiskReasonCode,
      sharedIntelMatchedSignalCount: relayRisk.matchedSignalCount,
      sharedIntelIgnoredSignalCount: relayRisk.ignoredSignalCount,
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
      attackModeSafetyProfile,
      attackModeReasonCode: attackModeDecision.reasonCode,
      relayRiskScore: relayRisk.relayRiskScore,
      relayRiskLevel: relayRisk.relayRiskLevel,
      relayRiskReasonCode: relayRisk.relayRiskReasonCode,
      sharedIntelMatchedSignalCount: relayRisk.matchedSignalCount,
      sharedIntelIgnoredSignalCount: relayRisk.ignoredSignalCount,
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
    attackModeSafetyProfile,
    attackModeReasonCode: attackModeDecision.reasonCode,
    relayRiskScore: relayRisk.relayRiskScore,
    relayRiskLevel: relayRisk.relayRiskLevel,
    relayRiskReasonCode: relayRisk.relayRiskReasonCode,
    sharedIntelMatchedSignalCount: relayRisk.matchedSignalCount,
    sharedIntelIgnoredSignalCount: relayRisk.ignoredSignalCount,
  };
};

export const resetIncomingRequestAntiAbuseState = (): void => {
  const scope = resolveProfileScope();
  getStateRoot().set(scope, createDefaultState());
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(getStorageKey());
  }
};

export type IncomingRequestAntiAbusePeerSnapshot = Readonly<{
  peerWindowCount: number;
  peerLimit: number;
  globalWindowCount: number;
  globalLimit: number;
  windowMs: number;
  cooldownActive: boolean;
  cooldownRemainingMs: number | null;
}>;

/** Read-only peer snapshot for trust assessment — does not record events. */
export const getIncomingRequestAntiAbusePeerSnapshot = (params: Readonly<{
  peerPublicKeyHex: PublicKeyHex;
  nowUnixMs?: number;
}>): IncomingRequestAntiAbusePeerSnapshot => {
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const rawState = getState();
  const state: IncomingRequestAntiAbuseState = {
    globalEventUnixMs: pruneEventWindow(rawState.globalEventUnixMs, nowUnixMs),
    peerEventUnixMsByPeer: rawState.peerEventUnixMsByPeer,
    peerCooldownUntilUnixMsByPeer: pruneCooldownMap(rawState.peerCooldownUntilUnixMsByPeer, nowUnixMs),
  };
  const peerKey = params.peerPublicKeyHex.toLowerCase() as PublicKeyHex;
  const peerWindowCount = pruneEventWindow(
    state.peerEventUnixMsByPeer.get(peerKey) ?? [],
    nowUnixMs,
  ).length;
  const cooldownUntilUnixMs = state.peerCooldownUntilUnixMsByPeer.get(peerKey) ?? null;
  const cooldownActive = typeof cooldownUntilUnixMs === "number" && cooldownUntilUnixMs > nowUnixMs;
  return {
    peerWindowCount,
    peerLimit: PEER_LIMIT,
    globalWindowCount: state.globalEventUnixMs.length,
    globalLimit: GLOBAL_LIMIT,
    windowMs: WINDOW_MS,
    cooldownActive,
    cooldownRemainingMs: cooldownActive && cooldownUntilUnixMs !== null
      ? Math.max(0, cooldownUntilUnixMs - nowUnixMs)
      : null,
  };
};

export const incomingRequestAntiAbuseInternals = {
  WINDOW_MS,
  PEER_COOLDOWN_MS,
  PEER_LIMIT,
  GLOBAL_LIMIT,
};
