import { describe, expect, it } from "vitest";
import { signMembershipDelta } from "@dweb/coordination-contracts";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

const LIVE_BASE_URL = process.env.COORDINATION_LIVE_URL?.trim() || "http://127.0.0.1:8787";
const priv = "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb" as PrivateKeyHex;
const actor = derivePublicKeyHex(priv);

describe("live coordination membership directory", () => {
  it.skipIf(!process.env.COORDINATION_LIVE)("appends join delta against running wrangler dev", async () => {
    const communityId = `v2_${"c".repeat(64)}`;
    const createdAtUnixMs = Date.now();
    const signature = await signMembershipDelta({
      communityId,
      action: "join",
      subjectPubkey: actor,
      actorPubkey: actor,
      createdAtUnixMs,
      actorPrivateKeyHex: priv,
    });
    const response = await fetch(
      `${LIVE_BASE_URL}/communities/${encodeURIComponent(communityId)}/membership/delta`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "join",
          subjectPubkey: actor,
          actorPubkey: actor,
          createdAtUnixMs,
          signature,
        }),
      },
    );
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.ok).toBe(true);
  });
});
