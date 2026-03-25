import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  clearSignedSharedIntelSignals,
  evaluateIncomingRequestAttackModeGate,
  evaluateSignedSharedIntelRelayRisk,
  getAttackModeSafetyProfile,
  getSignedSharedIntelSignals,
  hydrateSignedSharedIntelSignalsFromStorage,
  m10SharedIntelPolicyInternals,
  resetM10SharedIntelPolicyState,
  setAttackModeSafetyProfile,
  setSignedSharedIntelSignals,
  type SignedSharedIntelSignal,
} from "./m10-shared-intel-policy";

const PEER_A = "a".repeat(64) as PublicKeyHex;
const SIGNER = "c".repeat(64) as PublicKeyHex;

const createRelayBlockSignal = (params?: Readonly<{
  relayHost?: string;
  confidenceScore?: number;
  signalId?: string;
}>): SignedSharedIntelSignal => ({
  version: "obscur.m10.shared_intel.v1",
  signalId: params?.signalId ?? "relay-block-1",
  subjectType: "relay_host",
  subjectValue: params?.relayHost ?? "relay.bad.example",
  disposition: "block",
  confidenceScore: params?.confidenceScore ?? 90,
  reasonCode: "relay_known_spam_cluster",
  issuedAtUnixMs: 1_000,
  expiresAtUnixMs: 9_000,
  signerPublicKeyHex: SIGNER,
  signatureHex: "deadbeef",
});

describe("m10-shared-intel-policy", () => {
  beforeEach(() => {
    resetM10SharedIntelPolicyState();
    window.localStorage.clear();
  });

  it("keeps low relay risk when only local score is low", () => {
    const risk = evaluateSignedSharedIntelRelayRisk({
      relayUrl: "wss://relay.good.example",
      peerPublicKeyHex: PEER_A,
      localRelayRiskScore: 20,
      nowUnixMs: 3_000,
    });

    expect(risk.relayRiskScore).toBe(20);
    expect(risk.relayRiskLevel).toBe("low");
    expect(risk.relayRiskReasonCode).toBe("local_observation");
    expect(risk.matchedSignalCount).toBe(0);
  });

  it("applies signed relay block intel when signature verification succeeds", () => {
    const signal = createRelayBlockSignal();
    setSignedSharedIntelSignals([signal]);
    const risk = evaluateSignedSharedIntelRelayRisk({
      relayUrl: "wss://relay.bad.example",
      peerPublicKeyHex: PEER_A,
      signatureVerifier: () => true,
      nowUnixMs: 3_000,
    });

    expect(risk.matchedSignalCount).toBe(1);
    expect(risk.ignoredSignalCount).toBe(0);
    expect(risk.relayRiskLevel).toBe("high");
    expect(risk.relayRiskReasonCode).toBe("signed_shared_intel_relay_block");
  });

  it("ignores shared intel signals when no signature verifier is available", () => {
    const signal = createRelayBlockSignal();
    setSignedSharedIntelSignals([signal]);
    const risk = evaluateSignedSharedIntelRelayRisk({
      relayUrl: "wss://relay.bad.example",
      peerPublicKeyHex: PEER_A,
      nowUnixMs: 3_000,
    });

    expect(risk.matchedSignalCount).toBe(0);
    expect(risk.ignoredSignalCount).toBe(1);
    expect(risk.relayRiskLevel).toBe("low");
    expect(risk.relayRiskReasonCode).toBe("none");
  });

  it("enforces plaintext-boundary violations with high-risk contract reason", () => {
    const risk = evaluateSignedSharedIntelRelayRisk({
      relayUrl: "wss://relay.good.example",
      peerPublicKeyHex: PEER_A,
      payloadMetadata: {
        message: "should-never-be-scanned",
      },
    });

    expect(risk.contractViolationDetected).toBe(true);
    expect(risk.relayRiskLevel).toBe("high");
    expect(risk.relayRiskReasonCode).toBe("contract_violation_plaintext_boundary");
  });

  it("blocks strict mode on high relay risk and allows standard mode", () => {
    const strictDecision = evaluateIncomingRequestAttackModeGate({
      safetyProfile: "strict",
      relayRiskLevel: "high",
      peerBlockedBySharedIntel: false,
      contractViolationDetected: false,
    });
    const standardDecision = evaluateIncomingRequestAttackModeGate({
      safetyProfile: "standard",
      relayRiskLevel: "high",
      peerBlockedBySharedIntel: true,
      contractViolationDetected: true,
    });

    expect(strictDecision).toEqual({
      allowed: false,
      reasonCode: "blocked_strict_mode_relay_high_risk",
      safetyProfile: "strict",
    });
    expect(standardDecision).toEqual({
      allowed: true,
      reasonCode: "allowed_standard_mode",
      safetyProfile: "standard",
    });
  });

  it("persists and reads attack-mode safety profile from scoped storage", () => {
    expect(getAttackModeSafetyProfile()).toBe("standard");
    setAttackModeSafetyProfile("strict");
    expect(getAttackModeSafetyProfile()).toBe("strict");
    setAttackModeSafetyProfile("standard");
    expect(getAttackModeSafetyProfile()).toBe("standard");
  });

  it("normalizes relay hosts for deterministic matching", () => {
    expect(m10SharedIntelPolicyInternals.normalizeRelayHost("wss://Relay.Bad.Example/path")).toBe("relay.bad.example");
    expect(m10SharedIntelPolicyInternals.normalizeRelayHost("")).toBeNull();
  });

  it("persists signed shared-intel signals and clears them deterministically", () => {
    const signal = createRelayBlockSignal({ signalId: "persisted-1" });
    setSignedSharedIntelSignals([signal]);

    const persistedRaw = window.localStorage.getItem(m10SharedIntelPolicyInternals.getSignalsStorageKey());
    expect(persistedRaw).toContain(m10SharedIntelPolicyInternals.SHARED_INTEL_SIGNALS_STORAGE_VERSION);
    expect(getSignedSharedIntelSignals()).toHaveLength(1);

    clearSignedSharedIntelSignals();
    expect(getSignedSharedIntelSignals()).toHaveLength(0);
    expect(window.localStorage.getItem(m10SharedIntelPolicyInternals.getSignalsStorageKey())).toBeNull();
  });

  it("hydrates only valid persisted shared-intel signals from storage", () => {
    const key = m10SharedIntelPolicyInternals.getSignalsStorageKey();
    const valid = createRelayBlockSignal({ signalId: "valid-persisted" });
    window.localStorage.setItem(key, JSON.stringify({
      version: m10SharedIntelPolicyInternals.SHARED_INTEL_SIGNALS_STORAGE_VERSION,
      updatedAtUnixMs: 4_200,
      signals: [
        valid,
        { version: "broken", signalId: 123 },
      ],
    }));

    const hydrated = hydrateSignedSharedIntelSignalsFromStorage();
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]?.signalId).toBe("valid-persisted");
  });
});
