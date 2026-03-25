import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";

export type SignedSharedIntelSubjectType = "relay_host" | "peer_public_key";
export type SignedSharedIntelDisposition = "watch" | "block";
export type RelayRiskLevel = "low" | "elevated" | "high";
export type AttackModeSafetyProfile = "standard" | "strict";
export type SharedIntelIngestRejectionReason =
  | "invalid_shape"
  | "expired"
  | "missing_signature_verifier"
  | "invalid_signature";

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

export type SignedSharedIntelIngestResult = Readonly<{
  acceptedCount: number;
  rejectedCount: number;
  storedSignalCount: number;
  rejectedByReason: Readonly<Record<SharedIntelIngestRejectionReason, number>>;
  rejectedSignalIdSamples: ReadonlyArray<string>;
}>;

type SharedIntelPolicyState = {
  signals: SignedSharedIntelSignal[];
  signatureVerifier: SharedIntelSignatureVerifier | null;
};

type PersistedSharedIntelSignals = Readonly<{
  version: "obscur.m10.shared_intel_store.v1";
  updatedAtUnixMs: number;
  signals: ReadonlyArray<SignedSharedIntelSignal>;
}>;

const GLOBAL_STATE_KEY = "__obscur_m10_shared_intel_policy_state__";
const SHARED_INTEL_SIGNALS_STORAGE_KEY = "obscur.messaging.shared_intel_signals.v1";
const SHARED_INTEL_SIGNALS_STORAGE_VERSION = "obscur.m10.shared_intel_store.v1";
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

const isSignalSubjectType = (value: unknown): value is SignedSharedIntelSubjectType => (
  value === "relay_host" || value === "peer_public_key"
);

const isSignalDisposition = (value: unknown): value is SignedSharedIntelDisposition => (
  value === "watch" || value === "block"
);

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === "string" && value.trim().length > 0
);

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value)
);

const toNormalizedSignal = (value: unknown): SignedSharedIntelSignal | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.version !== "obscur.m10.shared_intel.v1") {
    return null;
  }
  if (!isNonEmptyString(record.signalId)) {
    return null;
  }
  if (!isSignalSubjectType(record.subjectType)) {
    return null;
  }
  if (!isNonEmptyString(record.subjectValue)) {
    return null;
  }
  if (!isSignalDisposition(record.disposition)) {
    return null;
  }
  if (!isFiniteNumber(record.confidenceScore)) {
    return null;
  }
  if (!isNonEmptyString(record.reasonCode)) {
    return null;
  }
  if (!isFiniteNumber(record.issuedAtUnixMs) || !isFiniteNumber(record.expiresAtUnixMs)) {
    return null;
  }
  if (!isNonEmptyString(record.signerPublicKeyHex)) {
    return null;
  }
  if (!isNonEmptyString(record.signatureHex)) {
    return null;
  }
  return {
    version: "obscur.m10.shared_intel.v1",
    signalId: record.signalId.trim(),
    subjectType: record.subjectType,
    subjectValue: record.subjectValue.trim(),
    disposition: record.disposition,
    confidenceScore: clampRiskScore(record.confidenceScore),
    reasonCode: record.reasonCode.trim(),
    issuedAtUnixMs: Math.floor(record.issuedAtUnixMs),
    expiresAtUnixMs: Math.floor(record.expiresAtUnixMs),
    signerPublicKeyHex: record.signerPublicKeyHex.trim() as PublicKeyHex,
    signatureHex: record.signatureHex.trim(),
  };
};

const getSignalsStorageKey = (): string => getScopedStorageKey(SHARED_INTEL_SIGNALS_STORAGE_KEY);

const readPersistedSignedSharedIntelSignals = (): SignedSharedIntelSignal[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(getSignalsStorageKey());
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Partial<PersistedSharedIntelSignals>;
    if (parsed.version !== SHARED_INTEL_SIGNALS_STORAGE_VERSION || !Array.isArray(parsed.signals)) {
      return [];
    }
    return parsed.signals
      .map((signal) => toNormalizedSignal(signal))
      .filter((signal): signal is SignedSharedIntelSignal => signal !== null);
  } catch {
    return [];
  }
};

const writePersistedSignedSharedIntelSignals = (signals: ReadonlyArray<SignedSharedIntelSignal>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const payload: PersistedSharedIntelSignals = {
    version: SHARED_INTEL_SIGNALS_STORAGE_VERSION,
    updatedAtUnixMs: Date.now(),
    signals: [...signals],
  };
  window.localStorage.setItem(getSignalsStorageKey(), JSON.stringify(payload));
};

const clearPersistedSignedSharedIntelSignals = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(getSignalsStorageKey());
};

const getState = (): SharedIntelPolicyState => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing as SharedIntelPolicyState;
  }
  const created: SharedIntelPolicyState = {
    signals: readPersistedSignedSharedIntelSignals(),
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
  const normalizedSignals = signals
    .map((signal) => toNormalizedSignal(signal))
    .filter((signal): signal is SignedSharedIntelSignal => signal !== null);
  state.signals = [...normalizedSignals];
  writePersistedSignedSharedIntelSignals(normalizedSignals);
};

export const getSignedSharedIntelSignals = (): ReadonlyArray<SignedSharedIntelSignal> => {
  return [...getState().signals];
};

export const hydrateSignedSharedIntelSignalsFromStorage = (): ReadonlyArray<SignedSharedIntelSignal> => {
  const signals = readPersistedSignedSharedIntelSignals();
  const state = getState();
  state.signals = [...signals];
  return [...signals];
};

export const clearSignedSharedIntelSignals = (): void => {
  const state = getState();
  state.signals = [];
  clearPersistedSignedSharedIntelSignals();
};

const DEFAULT_INGEST_REJECTION_COUNTERS: Readonly<Record<SharedIntelIngestRejectionReason, number>> = {
  invalid_shape: 0,
  expired: 0,
  missing_signature_verifier: 0,
  invalid_signature: 0,
};

export const ingestSignedSharedIntelSignals = (params: Readonly<{
  signals: ReadonlyArray<unknown>;
  replaceExisting?: boolean;
  requireSignatureVerification?: boolean;
  signatureVerifier?: SharedIntelSignatureVerifier | null;
  nowUnixMs?: number;
}>): SignedSharedIntelIngestResult => {
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const requireSignatureVerification = params.requireSignatureVerification !== false;
  const signatureVerifier = params.signatureVerifier ?? getState().signatureVerifier;
  const existingById = new Map<string, SignedSharedIntelSignal>();
  if (!params.replaceExisting) {
    getState().signals.forEach((signal) => {
      existingById.set(signal.signalId, signal);
    });
  }

  const rejectedByReason: Record<SharedIntelIngestRejectionReason, number> = {
    ...DEFAULT_INGEST_REJECTION_COUNTERS,
  };
  const rejectedSignalIdSamples: string[] = [];
  let acceptedCount = 0;

  for (const rawSignal of params.signals) {
    const normalizedSignal = toNormalizedSignal(rawSignal);
    if (!normalizedSignal) {
      rejectedByReason.invalid_shape += 1;
      if (rejectedSignalIdSamples.length < 6) {
        rejectedSignalIdSamples.push("unknown");
      }
      continue;
    }
    if (normalizedSignal.expiresAtUnixMs <= nowUnixMs) {
      rejectedByReason.expired += 1;
      if (rejectedSignalIdSamples.length < 6) {
        rejectedSignalIdSamples.push(normalizedSignal.signalId);
      }
      continue;
    }
    if (requireSignatureVerification && !signatureVerifier) {
      rejectedByReason.missing_signature_verifier += 1;
      if (rejectedSignalIdSamples.length < 6) {
        rejectedSignalIdSamples.push(normalizedSignal.signalId);
      }
      continue;
    }
    if (requireSignatureVerification && signatureVerifier) {
      const signatureValid = signatureVerifier({
        payload: getSignalPayload(normalizedSignal),
        signatureHex: normalizedSignal.signatureHex,
        signerPublicKeyHex: normalizedSignal.signerPublicKeyHex,
      });
      if (!signatureValid) {
        rejectedByReason.invalid_signature += 1;
        if (rejectedSignalIdSamples.length < 6) {
          rejectedSignalIdSamples.push(normalizedSignal.signalId);
        }
        continue;
      }
    }
    const existing = existingById.get(normalizedSignal.signalId);
    if (!existing || normalizedSignal.issuedAtUnixMs >= existing.issuedAtUnixMs) {
      existingById.set(normalizedSignal.signalId, normalizedSignal);
    }
    acceptedCount += 1;
  }

  const nextSignals = Array.from(existingById.values())
    .sort((left, right) => right.issuedAtUnixMs - left.issuedAtUnixMs);
  setSignedSharedIntelSignals(nextSignals);
  const rejectedCount = (
    rejectedByReason.invalid_shape
    + rejectedByReason.expired
    + rejectedByReason.missing_signature_verifier
    + rejectedByReason.invalid_signature
  );
  return {
    acceptedCount,
    rejectedCount,
    storedSignalCount: nextSignals.length,
    rejectedByReason,
    rejectedSignalIdSamples,
  };
};

export const resetM10SharedIntelPolicyState = (): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_STATE_KEY] = {
    signals: [],
    signatureVerifier: null,
  } as SharedIntelPolicyState;
  clearPersistedSignedSharedIntelSignals();
};

export const getAttackModeSafetyProfile = (): AttackModeSafetyProfile => {
  const settings = PrivacySettingsService.getSettings();
  return settings.attackModeSafetyProfileV121 === "strict" ? "strict" : "standard";
};

export const setAttackModeSafetyProfile = (profile: AttackModeSafetyProfile): void => {
  const settings = PrivacySettingsService.getSettings();
  PrivacySettingsService.saveSettings({
    ...settings,
    attackModeSafetyProfileV121: profile,
  });
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
  SHARED_INTEL_SIGNALS_STORAGE_KEY,
  SHARED_INTEL_SIGNALS_STORAGE_VERSION,
  PLAIN_TEXT_BOUNDARY_KEYS,
  getSignalPayload,
  getSignalsStorageKey,
  normalizeRelayHost,
  readPersistedSignedSharedIntelSignals,
  scoreSignal,
  toRelayRiskLevel,
  toNormalizedSignal,
  DEFAULT_INGEST_REJECTION_COUNTERS,
};
