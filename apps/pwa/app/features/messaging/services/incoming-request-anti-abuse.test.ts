import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateIncomingRequestAntiAbuse,
  incomingRequestAntiAbuseInternals,
  resetIncomingRequestAntiAbuseState,
} from "./incoming-request-anti-abuse";

const PEER_A = "a".repeat(64);
const PEER_B = "b".repeat(64);

describe("incoming-request-anti-abuse", () => {
  beforeEach(() => {
    resetIncomingRequestAntiAbuseState();
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
});
