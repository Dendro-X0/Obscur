import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  evaluatePathBConnectionRequestEconomicsGate,
  evaluatePathBIncomingDmSafetyGate,
  evaluatePathBM10StrictModeGate,
  resetIncomingRequestAntiAbuseState,
} from "./path-b-b5-extension-hooks";
import { rateLimiter } from "@/app/features/invites/utils/security-enhancements";
import {
  resetM10SharedIntelPolicyState,
  setAttackModeSafetyProfile,
} from "./m10-shared-intel-policy";

const PEER_A = "a".repeat(64) as PublicKeyHex;
const ACCOUNT = "b".repeat(64);

/**
 * P5 safety gate — reproducible tier from fixture logs (Path B B5).
 */
describe("P5 safety gate", () => {
  beforeEach(() => {
    resetIncomingRequestAntiAbuseState();
    resetM10SharedIntelPolicyState();
    rateLimiter.reset(`connection-req-${ACCOUNT}`);
  });

  it("P5-SAF-1 / fixture: peer incoming request rate limit after third event in window", () => {
    const fixture = [
      { nowUnixMs: 1_700_000_000_000, expectedAllowed: true, expectedReason: "allowed" },
      { nowUnixMs: 1_700_000_000_100, expectedAllowed: true, expectedReason: "allowed" },
      { nowUnixMs: 1_700_000_000_200, expectedAllowed: true, expectedReason: "allowed" },
      { nowUnixMs: 1_700_000_000_300, expectedAllowed: false, expectedReason: "peer_rate_limited" },
    ] as const;

    fixture.forEach((entry) => {
      const decision = evaluatePathBIncomingDmSafetyGate({
        peerPublicKeyHex: PEER_A,
        nowUnixMs: entry.nowUnixMs,
      });
      expect(decision.allowed).toBe(entry.expectedAllowed);
      expect(decision.reasonCode).toBe(entry.expectedReason);
    });
  });

  it("P5-SAF-2 / fixture: strict mode blocks high relay risk before rate accounting", () => {
    setAttackModeSafetyProfile("strict");
    const decision = evaluatePathBIncomingDmSafetyGate({
      peerPublicKeyHex: PEER_A,
      nowUnixMs: 1_700_000_000_000,
      localRelayRiskScore: 95,
      relayUrl: "wss://relay.bad.example",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("attack_mode_strict_relay_high_risk");
  });

  it("P5-SAF-3 / fixture: M10 strict gate blocks shared-intel peer disposition", () => {
    setAttackModeSafetyProfile("strict");
    const decision = evaluatePathBM10StrictModeGate({
      relayRiskLevel: "low",
      peerBlockedBySharedIntel: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("blocked_strict_mode_peer_shared_intel");
  });

  it("P5-SAF-4 / fixture: outbound connection request economics exhausts hourly quota", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(evaluatePathBConnectionRequestEconomicsGate(ACCOUNT)).toBe(true);
    }
    expect(evaluatePathBConnectionRequestEconomicsGate(ACCOUNT)).toBe(false);
  });
});
