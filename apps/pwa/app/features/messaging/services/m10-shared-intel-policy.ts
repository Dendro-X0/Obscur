import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

export type SignedSharedIntelSubjectType = "relay_host" | "peer_public_key";
export type SignedSharedIntelDisposition = "watch" | "block";
export type RelayRiskLevel = "low" | "elevated" | "high";
export type AttackModeSafetyProfile = "standard" | "strict";

export type AttackModeGateReasonCode =
  | "allowed_standard_mode"
  | "allowed_strict_mode"
  | "blocked_strict_mode_relay_high_risk"
  | "blocked_strict_mode_peer_shared_intel"
  | "blocked_strict_mode_contract_violation";

export type SignedSharedIntelSignal = Readonly<{
  version: "obscur.m10.shared_intel.v1";
  signalId: string;
  subjectType: SignedSharedIntelSubjectType;
  subjectValue: string;
  disposition: SignedSharedIntelDisposition;
  confidenceScore: number;
  reasonCode: string;
  issuedAtUnixMs: number;
  expiresAtUnixMs: number;
  signerPublicKeyHex: PublicKeyHex;
  signatureHex: string;
}>;

type RelayRiskReasonCode =
  | "none"
  | "local_observation"
  | "signed_shared_intel_relay_watch"
  | "signed_shared_intel_relay_block"
  | "signed_shared_intel_peer_block"
  | "contract_violation_plaintext_boundary";

export type SharedIntelSignatureVerifier = (params: Readonly<{
  payload: string;
  signatureHex: string;
  signerPublicKeyHex: PublicKeyHex;
}>) => boolean;

export type RelayRiskEvaluation = Readonly<{
  relayRiskScore: number;
  relayRiskLevel: RelayRiskLevel;
  relayRiskReasonCode: RelayRiskReasonCode;
  matchedSignalCount: number;
  ignoredSignalCount: number;
  peerBlockedBySharedIntel: boolean;
  contractViolationDetected: boolean;
}>;

export type AttackModeGateDecision = Readonly<{
  allowed: boolean;
  reasonCode: AttackModeGateReasonCode;
  safetyProfile: AttackModeSafetyProfile;
}>;

type SharedIntelPolicyState = {
  signals: SignedSharedIntelSignal[];
  signatureVerifier: SharedIntelSignatureVerifier | null;
};

const GLOBAL_STATE_KEY = "__obscur_m10_shared_intel_policy_state__";
const ATTACK_MODE_PROFILE_STORAGE_KEY = "obscur.messaging.attack_mode_safety_profile.v1";
const PLAIN_TEXT_BOUNDARY_KEYS: ReadonlySet<string> = new Set([
  "content",
  "plaintext",
  "message",
  "body",
  "text",
]);

const clampRiskScore = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const toRelayRiskLevel = (score: number): RelayRiskLevel => {
  if (score >= 70) return "high";
  if (score >= 35) return "elevated";
  return "low";
};

const normalizeRelayHost = (relayUrl: string | null | undefined): string | null => {
  if (!relayUrl || typeof relayUrl !== "string") return null;
  const trimmed = relayUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
};

const containsPlaintextBoundaryKey = (
  payloadMetadata: Readonly<Record<string, unknown>> | undefined,
): boolean => {
  if (!payloadMetadata) {
    return false;
  }
  return Object.keys(payloadMetadata).some((key) => (
    PLAIN_TEXT_BOUNDARY_KEYS.has(key.trim().toLowerCase())
  ));
};

const getState = (): SharedIntelPolicyState => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing as SharedIntelPolicyState;
  }
  const created: SharedIntelPolicyState = {
    signals: [],
    signatureVerifier: null,
  };
  root[GLOBAL_STATE_KEY] = created;
  return created;
};

const getSignalPayload = (signal: SignedSharedIntelSignal): string => (
  JSON.stringify({
    version: signal.version,
    signalId: signal.signalId,
    subjectType: signal.subjectType,
    subjectValue: signal.subjectValue,
    disposition: signal.disposition,
    confidenceScore: signal.confidenceScore,
    reasonCode: signal.reasonCode,
    issuedAtUnixMs: signal.issuedAtUnixMs,
    expiresAtUnixMs: signal.expiresAtUnixMs,
    signerPublicKeyHex: signal.signerPublicKeyHex,
  })
);

const scoreSignal = (signal: SignedSharedIntelSignal): number => {
  const confidence = clampRiskScore(signal.confidenceScore);
  if (signal.disposition === "watch") {
    return Math.max(10, Math.round(confidence * 0.25));
  }
  return Math.max(70, Math.round(confidence * 0.8));
};

export const setSharedIntelSignatureVerifier = (
  verifier: SharedIntelSignatureVerifier | null,
): void => {
  const state = getState();
  state.signatureVerifier = verifier;
};

export const setSignedSharedIntelSignals = (
  signals: ReadonlyArray<SignedSharedIntelSignal>,
): void => {
  const state = getState();
  state.signals = [...signals];
};

export const getSignedSharedIntelSignals = (): ReadonlyArray<SignedSharedIntelSignal> => {
  return [...getState().signals];
};

export const resetM10SharedIntelPolicyState = (): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_STATE_KEY] = {
    signals: [],
    signatureVerifier: null,
  } as SharedIntelPolicyState;
};

export const getAttackModeSafetyProfile = (): AttackModeSafetyProfile => {
  if (typeof window === "undefined") {
    return "standard";
  }
  const scopedKey = getScopedStorageKey(ATTACK_MODE_PROFILE_STORAGE_KEY);
  const raw = window.localStorage.getItem(scopedKey);
  return raw === "strict" ? "strict" : "standard";
};

export const setAttackModeSafetyProfile = (profile: AttackModeSafetyProfile): void => {
  if (typeof window === "undefined") {
    return;
  }
  const scopedKey = getScopedStorageKey(ATTACK_MODE_PROFILE_STORAGE_KEY);
  window.localStorage.setItem(scopedKey, profile);
  window.dispatchEvent(new Event("privacy-settings-changed"));
};

export const evaluateSignedSharedIntelRelayRisk = (params: Readonly<{
  relayUrl?: string | null;
  peerPublicKeyHex: PublicKeyHex;
  localRelayRiskScore?: number;
  sharedIntelSignals?: ReadonlyArray<SignedSharedIntelSignal>;
  signatureVerifier?: SharedIntelSignatureVerifier | null;
  payloadMetadata?: Readonly<Record<string, unknown>>;
  nowUnixMs?: number;
}>): RelayRiskEvaluation => {
  if (containsPlaintextBoundaryKey(params.payloadMetadata)) {
    return {
      relayRiskScore: 100,
      relayRiskLevel: "high",
      relayRiskReasonCode: "contract_violation_plaintext_boundary",
      matchedSignalCount: 0,
      ignoredSignalCount: 0,
      peerBlockedBySharedIntel: false,
      contractViolationDetected: true,
    };
  }

  const relayHost = normalizeRelayHost(params.relayUrl);
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const signatureVerifier = params.signatureVerifier ?? getState().signatureVerifier;
  const signals = params.sharedIntelSignals ?? getState().signals;

  let score = clampRiskScore(params.localRelayRiskScore ?? 0);
  let reasonCode: RelayRiskReasonCode = score > 0 ? "local_observation" : "none";
  let matchedSignalCount = 0;
  let ignoredSignalCount = 0;
  let peerBlockedBySharedIntel = false;

  for (const signal of signals) {
    if (signal.version !== "obscur.m10.shared_intel.v1") {
      ignoredSignalCount += 1;
      continue;
    }
    if (signal.expiresAtUnixMs <= nowUnixMs || signal.issuedAtUnixMs > nowUnixMs) {
      ignoredSignalCount += 1;
      continue;
    }
    if (!signatureVerifier) {
      ignoredSignalCount += 1;
      continue;
    }
    const signatureValid = signatureVerifier({
      payload: getSignalPayload(signal),
      signatureHex: signal.signatureHex,
      signerPublicKeyHex: signal.signerPublicKeyHex,
    });
    if (!signatureValid) {
      ignoredSignalCount += 1;
      continue;
    }

    const isRelayMatch = (
      signal.subjectType === "relay_host"
      && !!relayHost
      && signal.subjectValue.trim().toLowerCase() === relayHost
    );
    const isPeerMatch = (
      signal.subjectType === "peer_public_key"
      && signal.subjectValue.trim().toLowerCase() === params.peerPublicKeyHex.toLowerCase()
    );
    if (!isRelayMatch && !isPeerMatch) {
      continue;
    }

    matchedSignalCount += 1;
    score = clampRiskScore(score + scoreSignal(signal));

    if (isPeerMatch && signal.disposition === "block") {
      peerBlockedBySharedIntel = true;
      reasonCode = "signed_shared_intel_peer_block";
      continue;
    }
    if (isRelayMatch && signal.disposition === "block") {
      reasonCode = "signed_shared_intel_relay_block";
      continue;
    }
    if (isRelayMatch && signal.disposition === "watch" && reasonCode !== "signed_shared_intel_relay_block") {
      reasonCode = "signed_shared_intel_relay_watch";
    }
  }

  return {
    relayRiskScore: score,
    relayRiskLevel: toRelayRiskLevel(score),
    relayRiskReasonCode: reasonCode,
    matchedSignalCount,
    ignoredSignalCount,
    peerBlockedBySharedIntel,
    contractViolationDetected: false,
  };
};

export const evaluateIncomingRequestAttackModeGate = (params: Readonly<{
  safetyProfile: AttackModeSafetyProfile;
  relayRiskLevel: RelayRiskLevel;
  peerBlockedBySharedIntel: boolean;
  contractViolationDetected: boolean;
}>): AttackModeGateDecision => {
  if (params.safetyProfile === "standard") {
    return {
      allowed: true,
      reasonCode: "allowed_standard_mode",
      safetyProfile: "standard",
    };
  }

  if (params.contractViolationDetected) {
    return {
      allowed: false,
      reasonCode: "blocked_strict_mode_contract_violation",
      safetyProfile: "strict",
    };
  }
  if (params.peerBlockedBySharedIntel) {
    return {
      allowed: false,
      reasonCode: "blocked_strict_mode_peer_shared_intel",
      safetyProfile: "strict",
    };
  }
  if (params.relayRiskLevel === "high") {
    return {
      allowed: false,
      reasonCode: "blocked_strict_mode_relay_high_risk",
      safetyProfile: "strict",
    };
  }
  return {
    allowed: true,
    reasonCode: "allowed_strict_mode",
    safetyProfile: "strict",
  };
};

export const m10SharedIntelPolicyInternals = {
  ATTACK_MODE_PROFILE_STORAGE_KEY,
  PLAIN_TEXT_BOUNDARY_KEYS,
  getSignalPayload,
  normalizeRelayHost,
  scoreSignal,
  toRelayRiskLevel,
};
