import { afterEach, describe, expect, it } from "vitest";
import { UNIFIED_ACCOUNT_EXPORT_FORMAT } from "./unified-account-export-contracts";
import {
  clearPendingProfileImport,
  extractBundlePublicKeyHexFromRawJson,
  loadPendingProfileImport,
  pendingImportAccountPrefix,
  savePendingProfileImport,
} from "./pending-profile-import-service";

const UNIFIED_EXPORT = {
  version: 1,
  format: UNIFIED_ACCOUNT_EXPORT_FORMAT,
  exportedAtUnixMs: Date.now(),
  publicKeyHex: "a".repeat(64),
  portableAccountBundle: {
    version: 1,
    format: "obscur.portable_account_bundle.v1",
    payloadVersion: 1,
    exportedAtUnixMs: Date.now(),
    publicKeyHex: "a".repeat(64),
    ciphertext: "cipher",
  },
  workspaceBundle: null,
  manifest: {
    includesVaultMedia: false,
    portableEstimatedBytes: 100,
    workspaceEstimatedBytes: null,
  },
};

describe("pending profile import service", () => {
  afterEach(() => {
    clearPendingProfileImport("profile-2");
    clearPendingProfileImport("other-profile");
  });

  it("extracts bundle public key from unified export json", () => {
    const rawJson = JSON.stringify(UNIFIED_EXPORT);
    expect(extractBundlePublicKeyHexFromRawJson(rawJson)).toBe("a".repeat(64));
  });

  it("stores pending import scoped by profile id", () => {
    const rawJson = JSON.stringify(UNIFIED_EXPORT);
    const saved = savePendingProfileImport({
      profileId: "profile-2",
      fileName: "backup.obscur-account-export.json",
      rawJson,
    });
    expect(saved.profileId).toBe("profile-2");
    expect(saved.fileName).toBe("backup.obscur-account-export.json");
    expect(loadPendingProfileImport("profile-2")).toEqual(saved);
    expect(loadPendingProfileImport("other-profile")).toBeNull();
  });

  it("clears pending import for a profile", () => {
    savePendingProfileImport({
      profileId: "profile-2",
      fileName: "backup.json",
      rawJson: JSON.stringify(UNIFIED_EXPORT),
    });
    clearPendingProfileImport("profile-2");
    expect(loadPendingProfileImport("profile-2")).toBeNull();
  });

  it("formats account prefix labels", () => {
    expect(pendingImportAccountPrefix("abcdef0123456789")).toBe("abcdef01…");
  });
});
