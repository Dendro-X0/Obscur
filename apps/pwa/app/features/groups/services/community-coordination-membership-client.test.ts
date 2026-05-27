import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMembershipDeltaSignPayload,
  signMembershipDelta,
  verifyMembershipDeltaSignature,
} from "@dweb/coordination-contracts";
import { NATIVE_KEY_SENTINEL } from "../../crypto/crypto-service";
import {
  mapCoordinationRecordToSemantic,
  publishCoordinationMembershipDelta,
  resolveActorPrivateKeyForMembershipDeltaSigning,
} from "./community-coordination-membership-client";

const fetchCoordinationWithTimeout = vi.hoisted(() => vi.fn());

vi.mock("./community-coordination-fetch", () => ({
  CoordinationFetchError: class CoordinationFetchError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CoordinationFetchError";
    }
  },
  fetchCoordinationWithTimeout,
}));

vi.mock("./community-membership-sync-mode", () => ({
  getCoordinationBaseUrl: () => "http://127.0.0.1:8787",
}));

import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const priv = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb" as PrivateKeyHex;
const actor = derivePublicKeyHex(priv);
const peer = "b".repeat(64) as PublicKeyHex;

describe("community-coordination-membership-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sign/verify roundtrip for leave delta payload", async () => {
    const payload = buildMembershipDeltaSignPayload({
      communityId: "group-1",
      action: "leave",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs: 1_700_000_000,
    });
    expect(payload).toContain("group-1");
    const signature = await signMembershipDelta({
      communityId: "group-1",
      action: "leave",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs: 1_700_000_000,
      actorPrivateKeyHex: priv,
    });
    const valid = await verifyMembershipDeltaSignature({
      communityId: "group-1",
      action: "leave",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs: 1_700_000_000,
      signature,
    });
    expect(valid).toBe(true);
  });

  it("rejects native sentinel when native runtime is unavailable", async () => {
    vi.stubGlobal("window", undefined);
    await expect(
      resolveActorPrivateKeyForMembershipDeltaSigning(NATIVE_KEY_SENTINEL),
    ).rejects.toThrow("native_signing_unavailable");
  });

  it("maps coordination record to semantic leave", () => {
    const semantic = mapCoordinationRecordToSemantic({
      deltaId: "d1",
      communityId: "group-1",
      seq: 2,
      action: "leave",
      subjectPubkey: peer,
      actorPubkey: peer,
      createdAtUnixMs: 500,
      signature: "c".repeat(128),
    });
    expect(semantic?.type).toBe("COMMUNITY_MEMBER_LEFT");
    expect(semantic?.source).toBe("obscur_coordination");
  });

  it("publishes signed leave delta to coordination directory", async () => {
    fetchCoordinationWithTimeout.mockResolvedValue(new Response(
      JSON.stringify({ ok: true, data: { seq: 3 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const result = await publishCoordinationMembershipDelta({
      communityId: "group-1",
      action: "leave",
      subjectPubkey: actor,
      actorPubkey: actor,
      actorPrivateKeyHex: priv,
      createdAtUnixMs: 1_700_000_000,
    });
    expect(result.success).toBe(true);
    expect(result.seq).toBe(3);
    expect(fetchCoordinationWithTimeout).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/communities/group-1/membership/delta",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces coordination fetch failures without throwing", async () => {
    const { CoordinationFetchError } = await import("./community-coordination-fetch");
    fetchCoordinationWithTimeout.mockRejectedValue(
      new CoordinationFetchError("network_unreachable", { causeCode: "failed_to_fetch" }),
    );
    const result = await publishCoordinationMembershipDelta({
      communityId: "group-1",
      action: "leave",
      subjectPubkey: actor,
      actorPubkey: actor,
      actorPrivateKeyHex: priv,
    });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("network_unreachable");
  });
});
