import { describe, expect, it } from "vitest";
import {
  assessDmTrustWarning,
  BUNDLE_CONN_BURST,
} from "./dm-kernel-trust-assessment-port";
import { detectConnectionRequestBurstSignal } from "./dm-kernel-trust-connection-signals";
import {
  evaluateIncomingRequestAntiAbuse,
  getIncomingRequestAntiAbusePeerSnapshot,
  incomingRequestAntiAbuseInternals,
  resetIncomingRequestAntiAbuseState,
} from "@/app/features/messaging/services/incoming-request-anti-abuse";

const PEER = "e".repeat(64);
const baseMs = 1_700_000_100_000;

describe("dm-kernel trust connection convergence (v2.0b)", () => {
  it("detects burst when anti-abuse peer window is at limit", () => {
    const snapshot = getIncomingRequestAntiAbusePeerSnapshot({
      peerPublicKeyHex: PEER,
      nowUnixMs: baseMs,
    });
    expect(detectConnectionRequestBurstSignal({
      ...snapshot,
      peerWindowCount: snapshot.peerLimit,
      cooldownActive: false,
    })).toBe(true);
  });

  it("fires BUNDLE_CONN_BURST for cold contact + connection request burst snapshot", () => {
    const result = assessDmTrustWarning({
      peerPublicKeyHex: PEER,
      isPeerAccepted: false,
      messageContent: "hey again",
      messageTimestampUnixMs: baseMs,
      threadFirstPeerMessageAtUnixMs: baseMs,
      dismissedUntilUnixMs: null,
      connectionRequestBurstSnapshot: {
        peerWindowCount: incomingRequestAntiAbuseInternals.PEER_LIMIT,
        peerLimit: incomingRequestAntiAbuseInternals.PEER_LIMIT,
        globalWindowCount: 1,
        globalLimit: incomingRequestAntiAbuseInternals.GLOBAL_LIMIT,
        windowMs: incomingRequestAntiAbuseInternals.WINDOW_MS,
        cooldownActive: false,
        cooldownRemainingMs: null,
      },
      nowUnixMs: baseMs,
    });
    expect(result.bundleId).toBe(BUNDLE_CONN_BURST);
    expect(result.tier).toBe("elevated");
    expect(result.activeSignals).toContain("connection.request_burst");
  });

  it("reads anti-abuse snapshot after allowed connection requests without double-recording in trust hook", () => {
    resetIncomingRequestAntiAbuseState();
    evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER, nowUnixMs: baseMs });
    evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER, nowUnixMs: baseMs + 100 });
    evaluateIncomingRequestAntiAbuse({ peerPublicKeyHex: PEER, nowUnixMs: baseMs + 200 });
    const snapshot = getIncomingRequestAntiAbusePeerSnapshot({
      peerPublicKeyHex: PEER,
      nowUnixMs: baseMs + 250,
    });
    expect(snapshot.peerWindowCount).toBe(incomingRequestAntiAbuseInternals.PEER_LIMIT);
    expect(detectConnectionRequestBurstSignal(snapshot)).toBe(true);
  });
});
