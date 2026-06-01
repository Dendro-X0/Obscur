import { describe, expect, it } from "vitest";
import { UNIFIED_ACCOUNT_EXPORT_FORMAT } from "./unified-account-export-contracts";
import {
  parsePortableOrUnifiedImportEnvelope,
  parseUnifiedAccountExportEnvelope,
} from "./unified-account-export-service";

const PORTABLE_BUNDLE = {
  version: 1,
  format: "obscur.portable_account_bundle.v1",
  payloadVersion: 1,
  exportedAtUnixMs: 1_700_000_000_000,
  publicKeyHex: "a".repeat(64),
  ciphertext: "encrypted",
} as const;

describe("unified-account-export-service", () => {
  it("parses unified export envelopes", () => {
    const envelope = {
      version: 1,
      format: UNIFIED_ACCOUNT_EXPORT_FORMAT,
      exportedAtUnixMs: 1_700_000_000_000,
      publicKeyHex: "a".repeat(64),
      portableAccountBundle: PORTABLE_BUNDLE,
      workspaceBundle: null,
      manifest: {
        includesVaultMedia: false,
        portableEstimatedBytes: 100,
        workspaceEstimatedBytes: null,
      },
    };
    expect(parseUnifiedAccountExportEnvelope(envelope)?.format).toBe(UNIFIED_ACCOUNT_EXPORT_FORMAT);
  });

  it("accepts legacy portable-only JSON for import", () => {
    const parsed = parsePortableOrUnifiedImportEnvelope(PORTABLE_BUNDLE);
    expect(parsed?.kind).toBe("portable");
  });

  it("rejects invalid envelopes", () => {
    expect(parseUnifiedAccountExportEnvelope({ version: 2 })).toBeNull();
    expect(parsePortableOrUnifiedImportEnvelope({})).toBeNull();
  });
});
