import { describe, expect, it } from "vitest";
import { sealContinuityM1Snapshot, serializeContinuityM1SealedEnvelope } from "./vite-continuity-m1-seal";
import {
  CONTINUITY_M1_SNAPSHOT_FORMAT,
  type ContinuityM1Snapshot,
} from "./continuity-m1-snapshot";
import {
  createContinuityM4Offer,
  serializeContinuityM4Offer,
  verifyContinuityM4Offer,
} from "./continuity-m4-offer";

describe("continuity-m4-offer (Cut 10.1)", () => {
  it("creates and verifies an offer with transfer code + TTL", async () => {
    const snapshot: ContinuityM1Snapshot = {
      version: 1,
      format: CONTINUITY_M1_SNAPSHOT_FORMAT,
      createdAtUnixMs: 1,
      publicKeyHex: "aa".repeat(32),
      identityUnlock: { encryptedPrivateKey: "enc" },
      profile: {},
      peerTrust: { acceptedPeers: [], mutedPeers: [] },
      privacySettings: {},
      relayList: [],
      uiSettings: {},
    };
    const envelope = await sealContinuityM1Snapshot({
      snapshot,
      continuityPassphrase: "continuity-pass",
    });
    const sealedEnvelopeJson = serializeContinuityM1SealedEnvelope(envelope);
    const now = 1_700_000_000_000;
    const offer = createContinuityM4Offer({
      sealedEnvelopeJson,
      transferCode: "123456",
      nowUnixMs: now,
      ttlMs: 60_000,
    });
    expect(offer.transferCode).toBe("123456");
    expect(offer.expiresAtUnixMs).toBe(now + 60_000);

    const ok = verifyContinuityM4Offer({
      offer: serializeContinuityM4Offer(offer),
      transferCode: "123456",
      nowUnixMs: now + 1_000,
    });
    expect(ok.ok).toBe(true);

    const wrong = verifyContinuityM4Offer({
      offer,
      transferCode: "000000",
      nowUnixMs: now,
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.reasonCode).toBe("wrong_code");
    }

    const expired = verifyContinuityM4Offer({
      offer,
      transferCode: "123456",
      nowUnixMs: now + 120_000,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.reasonCode).toBe("expired");
    }
  }, 60_000);
});
