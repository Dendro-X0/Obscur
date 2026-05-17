import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateIncomingRequestAntiAbuse,
  incomingRequestAntiAbuseInternals,
  resetIncomingRequestAntiAbuseState,
} from "./incoming-request-anti-abuse";
import { resetM10SharedIntelPolicyState } from "./m10-shared-intel-policy";

const PEER_A = "a".repeat(64);
const PEER_B = "b".repeat(64);
const SIGNER = "c".repeat(64);

describe("incoming-request-anti-abuse", () => {
  beforeEach(() => {
    resetIncomingRequestAntiAbuseState();
    resetM10SharedIntelPolicyState();
    window.localStorage.clear();
  });

  it("allows request events under per-peer threshold", () => {
    const baseMs = 1_000;
    const first = evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs });
    const second = evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs + 100 });
    const third = evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs + 200 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
    expect(third.peerWindowCount).toBe(3);
  });

  it("blocks on peer burst over threshold within window", () => {
    const baseMs = 2_000;
    evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs });
    evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs + 100 });
    evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs + 200 });

    const blocked = evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs + 300 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasonCode).toBe("peer_rate_limited");
    expect(blocked.peerWindowCount).toBe(4);
    expect(blocked.peerCooldownMs).toBe(incomingRequestAntiAbuseInternals.PEER_COOLDOWN_MS);
    expect(blocked.cooldownRemainingMs).toBe(incomingRequestAntiAbuseInternals.PEER_COOLDOWN_MS);

    const cooldownBlocked = evaluateIncomingRequestAntiAbuse({
      peerPublicKeyHex: PEER_A,
      nowUnixMs: baseMs + 350,
    });
    expect(cooldownBlocked.allowed).toBe(false);
    expect(cooldownBlocked.reasonCode).toBe("peer_cooldown_active");
    expect(cooldownBlocked.peerCooldownMs).toBe(incomingRequestAntiAbuseInternals.PEER_COOLDOWN_MS);
    expect(cooldownBlocked.cooldownRemainingMs).toBeGreaterThan(0);

    const allowedAfterCooldown = evaluateIncomingRequestAntiAbuse({
      peerPublicKeyHex: PEER_A,
      nowUnixMs: baseMs + 300 + incomingRequestAntiAbuseInternals.PEER_COOLDOWN_MS + 10,
    });
    expect(allowedAfterCooldown.allowed).toBe(true);
    expect(allowedAfterCooldown.reasonCode).toBe("allowed");
    expect(allowedAfterCooldown.cooldownRemainingMs).toBeNull();
  });

  it("blocks on global burst across multiple peers", () => {
    const baseMs = 3_000;
    for (let i = 0; i < 20; i += 1) {
      const peer = i.toString(16).padStart(64, "0");
      evaluateIncomingRequestAntiAbuse({
        peerPublicKeyHex: peer,
        nowUnixMs: baseMs + i,
      });
    }

    const blocked = evaluateIncomingRequestAntiAbuse({
      peerPublicKeyHex: PEER_B,
      nowUnixMs: baseMs + 500,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasonCode).toBe("global_rate_limited");
    expect(blocked.globalWindowCount).toBe(21);
  });

  it("blocks strict-mode requests when signed relay intel marks the relay as high risk", () => {
    const decision = evaluateIncomingRequestAntiAbuse({
      peerPublicKeyHex: PEER_A,
      relayUrl: "wss://relay.bad.example",
      attackModeSafetyProfile: "strict",
      nowUnixMs: 5_000,
      sharedIntelSignatureVerifier: () => true,
      sharedIntelSignals: [
        {
          version: "obscur.m10.shared_intel.v1",
          signalId: "relay-signal-1",
          subjectType: "relay_host",
          subjectValue: "relay.bad.example",
          disposition: "block",
          confidenceScore: 95,
          reasonCode: "relay_known_spam_cluster",
          issuedAtUnixMs: 4_000,
          expiresAtUnixMs: 9_000,
          signerPublicKeyHex: SIGNER,
          signatureHex: "signed",
        },
      ],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("attack_mode_strict_relay_high_risk");
    expect(decision.attackModeReasonCode).toBe("blocked_strict_mode_relay_high_risk");
    expect(decision.relayRiskLevel).toBe("high");
    expect(decision.sharedIntelMatchedSignalCount).toBe(1);
  });

  it("blocks strict-mode requests when signed peer intel marks peer as blocked", () => {
    const decision = evaluateIncomingRequestAntiAbuse({
      peerPublicKeyHex: PEER_A,
      attackModeSafetyProfile: "strict",
      nowUnixMs: 5_000,
      sharedIntelSignatureVerifier: () => true,
      sharedIntelSignals: [
        {
          version: "obscur.m10.shared_intel.v1",
          signalId: "peer-signal-1",
          subjectType: "peer_public_key",
          subjectValue: PEER_A,
          disposition: "block",
          confidenceScore: 90,
          reasonCode: "peer_known_spam_actor",
          issuedAtUnixMs: 4_000,
          expiresAtUnixMs: 9_000,
          signerPublicKeyHex: SIGNER,
          signatureHex: "signed",
        },
      ],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("attack_mode_peer_shared_intel_blocked");
    expect(decision.attackModeReasonCode).toBe("blocked_strict_mode_peer_shared_intel");
    expect(decision.relayRiskLevel).toBe("high");
  });

  it("keeps request allowed when strict mode is set but shared intel is unsigned", () => {
    const decision = evaluateIncomingRequestAntiAbuse({
      peerPublicKeyHex: PEER_A,
      relayUrl: "wss://relay.bad.example",
      attackModeSafetyProfile: "strict",
      nowUnixMs: 5_000,
      sharedIntelSignals: [
        {
          version: "obscur.m10.shared_intel.v1",
          signalId: "relay-signal-unsigned",
          subjectType: "relay_host",
          subjectValue: "relay.bad.example",
          disposition: "block",
          confidenceScore: 95,
          reasonCode: "relay_known_spam_cluster",
          issuedAtUnixMs: 4_000,
          expiresAtUnixMs: 9_000,
          signerPublicKeyHex: SIGNER,
          signatureHex: "unsigned",
        },
      ],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("allowed");
    expect(decision.sharedIntelMatchedSignalCount).toBe(0);
    expect(decision.sharedIntelIgnoredSignalCount).toBe(1);
  });
});
