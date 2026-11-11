import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptContinuityPeerHistoryGrant,
  createContinuityPeerHistoryGrantOffer,
  readContinuityPeerHistoryGrants,
  recordOutgoingContinuityPeerHistoryGrant,
  serializeContinuityPeerHistoryGrantOffer,
  verifyContinuityPeerHistoryGrantOffer,
} from "./continuity-peer-history-grant";

describe("continuity-peer-history-grant (Cut 15.1)", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    vi.stubGlobal("crypto", {
      randomUUID: () => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
  });

  it("creates, verifies, and accepts opaque peer grants without CRM invent", () => {
    const offer = createContinuityPeerHistoryGrantOffer({
      recipientPublicKeyHex: "aa".repeat(16),
      grantorPublicKeyHexHint: "bb".repeat(16),
      transferCode: "123456",
      nowUnixMs: 1000,
      ttlMs: 10_000,
    });
    expect(offer.honestyNote).toBe("opaque_history_grant");
    expect(offer.format).toBe("obscur.continuity_peer_grant.v1");
    recordOutgoingContinuityPeerHistoryGrant("default", offer);
    expect(readContinuityPeerHistoryGrants("default")).toHaveLength(1);

    const verified = verifyContinuityPeerHistoryGrantOffer({
      offer: serializeContinuityPeerHistoryGrantOffer(offer),
      transferCode: "123456",
      nowUnixMs: 2000,
    });
    expect(verified.ok).toBe(true);

    const accepted = acceptContinuityPeerHistoryGrant({
      profileId: "default",
      offer,
      transferCode: "123456",
      expectedRecipientPublicKeyHex: "aa".repeat(16),
      nowUnixMs: 2000,
    });
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.record.status).toBe("accepted");
      expect(accepted.record.honestyNote).toBe("opaque_history_grant");
    }
    expect(JSON.stringify(readContinuityPeerHistoryGrants("default"))).not.toMatch(
      /relationship_edge|upsertRelationship/,
    );
  });

  it("refuses wrong code and expired grants", () => {
    const offer = createContinuityPeerHistoryGrantOffer({
      recipientPublicKeyHex: "aa".repeat(16),
      transferCode: "111111",
      nowUnixMs: 1000,
      ttlMs: 10,
    });
    expect(verifyContinuityPeerHistoryGrantOffer({
      offer,
      transferCode: "000000",
      nowUnixMs: 1001,
    }).ok).toBe(false);
    expect(verifyContinuityPeerHistoryGrantOffer({
      offer,
      transferCode: "111111",
      nowUnixMs: 2000,
    }).reasonCode).toBe("expired");
  });
});
