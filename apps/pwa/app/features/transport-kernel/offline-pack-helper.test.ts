import { describe, expect, it, vi } from "vitest";

import {
  assembleOfflinePackJson,
  chunkOfflinePackJson,
  OBSCUR_OFFLINE_QR_V1,
  parseOfflineQrChunkJson,
} from "./offline-pack-qr-chunks";
import {
  buildExportOfflinePackRequest,
  buildImportOfflinePackRequest,
  buildLabOfflineEnvelopeWire,
  exportOfflinePackViaHost,
  importOfflinePackViaHost,
  isAllowedOfflinePackPath,
} from "./offline-pack-usb-helper";
import type { HostEnginePort } from "@obscur/engine-contracts";

describe("offline-pack-qr-chunks — RUST-6d", () => {
  it("round-trips pack JSON through chunks", () => {
    const packJson = JSON.stringify({
      schema: "obscur-offline-pack/v1",
      profileIdHint: "bob",
      packMac: "2728ce2f2712fc07781a53f49677bcc80c2a01eaf7567874ddf546b5a3b89998",
      envelopes: [{ envelopeId: "env-1" }],
    });
    const chunks = chunkOfflinePackJson(packJson, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.schema).toBe(OBSCUR_OFFLINE_QR_V1);
    expect(chunks[0]?.packMacPrefix).toBe("2728ce2f");
    const assembled = assembleOfflinePackJson(chunks);
    expect(assembled).toEqual({ ok: true, packJson });
  });

  it("rejects incomplete assembly", () => {
    const long = `{"packMac":"aabbccddeeff0011","pad":"${"x".repeat(200)}"}`;
    const chunks = chunkOfflinePackJson(long, 80);
    expect(chunks.length).toBeGreaterThan(1);
    expect(assembleOfflinePackJson(chunks.slice(0, 1)).ok).toBe(false);
  });

  it("parses chunk JSON", () => {
    const parsed = parseOfflineQrChunkJson(JSON.stringify({
      schema: OBSCUR_OFFLINE_QR_V1,
      packMacPrefix: "aabbccdd",
      index: 0,
      total: 1,
      payload: "{}",
    }));
    expect(parsed.ok).toBe(true);
  });
});

describe("offline-pack-usb-helper — RUST-6d", () => {
  it("validates pack paths", () => {
    expect(isAllowedOfflinePackPath("C:/tmp/x.obscur-offline-pack.json")).toBe(true);
    expect(isAllowedOfflinePackPath("pack.json")).toBe(true);
    expect(isAllowedOfflinePackPath("evil.exe")).toBe(false);
  });

  it("builds export/import invoke requests with explicit profileId", () => {
    const envelope = buildLabOfflineEnvelopeWire({
      envelopeId: "env-1",
      profileId: "bob",
      ciphertextBase64: "CQgHBg==",
    });
    const exportReq = buildExportOfflinePackRequest({
      profileId: "bob",
      packKeyHex: "07".repeat(32),
      envelopes: [envelope],
      fileName: "sneakernet.obscur-offline-pack.json",
    });
    expect(exportReq).toMatchObject({
      engine: "transport",
      method: "exportOfflinePack",
      scope: { profileId: "bob" },
    });
    const importReq = buildImportOfflinePackRequest({
      profileId: "bob",
      packKeyHex: "07".repeat(32),
      filePath: "/tmp/sneakernet.obscur-offline-pack.json",
      persistToDm: true,
    });
    expect(importReq.method).toBe("importOfflinePack");
    expect((importReq.payload as { persistToDm: boolean }).persistToDm).toBe(true);
  });

  it("exportOfflinePackViaHost maps host outcomes", async () => {
    const host: HostEnginePort = {
      invoke: vi.fn(async () => ({
        ok: true,
        data: { ok: true, filePath: "/tmp/out.obscur-offline-pack.json", evidence: [] },
      })),
      getSnapshot: vi.fn(),
      subscribe: () => () => {},
    };
    const result = await exportOfflinePackViaHost({
      profileId: "bob",
      packKeyHex: "07".repeat(32),
      envelopes: [buildLabOfflineEnvelopeWire({
        envelopeId: "env-1",
        profileId: "bob",
        ciphertextBase64: "CQgHBg==",
      })],
      fileName: "out.obscur-offline-pack.json",
      host,
    });
    expect(result).toEqual({
      attempted: true,
      ok: true,
      data: { ok: true, filePath: "/tmp/out.obscur-offline-pack.json", evidence: [] },
    });
  });

  it("importOfflinePackViaHost soft-fails rejectReason", async () => {
    const host: HostEnginePort = {
      invoke: vi.fn(async () => ({
        ok: true,
        data: { ok: false, rejectReason: "profile_scope_mismatch", evidence: [] },
      })),
      getSnapshot: vi.fn(),
      subscribe: () => () => {},
    };
    const result = await importOfflinePackViaHost({
      profileId: "alice",
      packKeyHex: "07".repeat(32),
      filePath: "/tmp/pack.obscur-offline-pack.json",
      host,
    });
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe("profile_scope_mismatch");
  });
});
