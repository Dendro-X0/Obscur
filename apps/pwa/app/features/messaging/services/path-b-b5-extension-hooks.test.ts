import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  evaluatePathBConnectionRequestEconomicsGate,
  evaluatePathBIncomingDmSafetyGate,
  evaluatePathBM10StrictModeGate,
  resetIncomingRequestAntiAbuseState,
  shouldShowPathBThreadWarningBanner,
} from "./path-b-b5-extension-hooks";
import { rateLimiter } from "@/app/features/invites/utils/security-enhancements";
import { resetM10SharedIntelPolicyState, setAttackModeSafetyProfile } from "./m10-shared-intel-policy";

const PEER_A = "a".repeat(64) as PublicKeyHex;
const ACCOUNT = "b".repeat(64);

describe("path-b-b5-extension-hooks", () => {
  beforeEach(() => {
    resetIncomingRequestAntiAbuseState();
    resetM10SharedIntelPolicyState();
    rateLimiter.reset(`connection-req-${ACCOUNT}`);
  });

  it("shouldShowPathBThreadWarningBanner is recipient-only for unaccepted DM peers", () => {
    expect(shouldShowPathBThreadWarningBanner({
      conversationKind: "dm",
      isPeerAccepted: false,
    })).toBe(true);
    expect(shouldShowPathBThreadWarningBanner({
      conversationKind: "dm",
      isPeerAccepted: true,
    })).toBe(false);
    expect(shouldShowPathBThreadWarningBanner({
      conversationKind: "group",
      isPeerAccepted: false,
    })).toBe(false);
  });

  it("evaluatePathBIncomingDmSafetyGate delegates to incoming anti-abuse rate limits", () => {
    const baseMs = 1_700_000_000_000;
    evaluatePathBIncomingDmSafetyGate({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs });
    evaluatePathBIncomingDmSafetyGate({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs + 100 });
    evaluatePathBIncomingDmSafetyGate({ peerPublicKeyHex: PEER_A, nowUnixMs: baseMs + 200 });

    const blocked = evaluatePathBIncomingDmSafetyGate({
      peerPublicKeyHex: PEER_A,
      nowUnixMs: baseMs + 300,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasonCode).toBe("peer_rate_limited");
  });

  it("evaluatePathBM10StrictModeGate blocks strict mode high relay risk", () => {
    setAttackModeSafetyProfile("strict");
    const decision = evaluatePathBM10StrictModeGate({
      relayRiskLevel: "high",
      peerBlockedBySharedIntel: false,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("blocked_strict_mode_relay_high_risk");
  });

  it("evaluatePathBConnectionRequestEconomicsGate respects invite economics rate limit", () => {
    expect(evaluatePathBConnectionRequestEconomicsGate(ACCOUNT)).toBe(true);
    rateLimiter.reset(`connection-req-${ACCOUNT}`);
    for (let index = 0; index < 50; index += 1) {
      expect(evaluatePathBConnectionRequestEconomicsGate(ACCOUNT)).toBe(true);
    }
    expect(evaluatePathBConnectionRequestEconomicsGate(ACCOUNT)).toBe(false);
  });
});
