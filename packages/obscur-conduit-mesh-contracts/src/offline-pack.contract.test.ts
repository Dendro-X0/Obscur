import { describe, expect, it } from "vitest";

import {
  OBSCUR_OFFLINE_PACK_V1,
  encodeOfflinePack,
  parseOfflinePackJson,
  satisfiesEvidenceClass,
  verifyOfflinePackForImport,
} from "./index";
import type { MeshEnvelope } from "./index";

const packKey = () => new Uint8Array(32).fill(7);

const sampleEnvelope = (profileId = "profile-a"): MeshEnvelope => ({
  envelopeId: "env-offline-1",
  scope: { profileId },
  messageScope: "dm",
  audience: { kind: "dm", recipientPublicKeyHex: "abc123" },
  ciphertext: new Uint8Array([9, 8, 7, 6]),
  evidenceClass: "accepted_when_imported",
  createdAtUnixMs: 1_700_000_000_000,
});

describe("conduit-mesh-contracts — RUST-6a offline pack", () => {
  it("round-trips encode → JSON → verify for matching profile", async () => {
    const encoded = await encodeOfflinePack({
      profileIdHint: "profile-a",
      envelopes: [sampleEnvelope()],
      packKey: packKey(),
      createdAtUnixMs: 1_700_000_000_000,
      expiresAtUnixMs: 1_800_000_000_000,
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }
    expect(encoded.pack.schema).toBe(OBSCUR_OFFLINE_PACK_V1);
    expect(encoded.pack.packMac).toBe(
      "2728ce2f2712fc07781a53f49677bcc80c2a01eaf7567874ddf546b5a3b89998",
    );

    const parsed = parseOfflinePackJson(JSON.stringify(encoded.pack));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const verified = await verifyOfflinePackForImport({
      pack: parsed.pack,
      packKey: packKey(),
      profileId: "profile-a",
      nowUnixMs: 1_700_000_100_000,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) {
      return;
    }
    expect(verified.envelopes).toHaveLength(1);
    expect(verified.envelopes[0]?.ciphertext).toEqual(new Uint8Array([9, 8, 7, 6]));
  });

  it("rejects empty envelope list", async () => {
    const encoded = await encodeOfflinePack({
      profileIdHint: "profile-a",
      envelopes: [],
      packKey: packKey(),
    });
    expect(encoded).toEqual({ ok: false, reason: "pack_empty" });
  });

  it("rejects tampered pack MAC", async () => {
    const encoded = await encodeOfflinePack({
      profileIdHint: "profile-a",
      envelopes: [sampleEnvelope()],
      packKey: packKey(),
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }
    const tampered = {
      ...encoded.pack,
      packMac: "00".repeat(32),
    };
    const verified = await verifyOfflinePackForImport({
      pack: tampered,
      packKey: packKey(),
      profileId: "profile-a",
    });
    expect(verified).toEqual({ ok: false, reason: "pack_mac_invalid" });
  });

  it("rejects expired pack", async () => {
    const encoded = await encodeOfflinePack({
      profileIdHint: "profile-a",
      envelopes: [sampleEnvelope()],
      packKey: packKey(),
      createdAtUnixMs: 1_000,
      expiresAtUnixMs: 2_000,
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }
    const verified = await verifyOfflinePackForImport({
      pack: encoded.pack,
      packKey: packKey(),
      profileId: "profile-a",
      nowUnixMs: 3_000,
    });
    expect(verified).toEqual({ ok: false, reason: "pack_expired" });
  });

  it("rejects wrong import profileId", async () => {
    const encoded = await encodeOfflinePack({
      profileIdHint: "profile-a",
      envelopes: [sampleEnvelope("profile-a")],
      packKey: packKey(),
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) {
      return;
    }
    const verified = await verifyOfflinePackForImport({
      pack: encoded.pack,
      packKey: packKey(),
      profileId: "profile-b",
    });
    expect(verified.ok).toBe(false);
    if (verified.ok) {
      return;
    }
    expect(verified.reason).toBe("profile_scope_mismatch");
  });

  it("rejects invalid schema JSON", () => {
    expect(parseOfflinePackJson("{}")).toEqual({ ok: false, reason: "schema_invalid" });
    expect(parseOfflinePackJson("not-json")).toEqual({ ok: false, reason: "json_invalid" });
  });

  it("accepted_when_imported evidence class requires imported_offline", () => {
    expect(satisfiesEvidenceClass("accepted_when_imported", [{
      evidenceId: "e1",
      envelopeId: "env-1",
      kind: "accepted_by_operator",
      atUnixMs: 1,
    }])).toBe(false);
    expect(satisfiesEvidenceClass("accepted_when_imported", [{
      evidenceId: "e1",
      envelopeId: "env-1",
      kind: "imported_offline",
      atUnixMs: 1,
    }])).toBe(true);
  });
});
