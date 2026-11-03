import { afterEach, describe, expect, it, vi } from "vitest";
import type { IdentityRecord } from "@dweb/core/identity-record";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  IDENTITY_RECOVERY_FILE_SCHEMA,
  buildIdentityRecoveryFileName,
  buildIdentityRecoveryFilePayload,
  downloadIdentityRecoveryFile,
} from "./download-identity-recovery-file";

const sampleRecord = (): IdentityRecord => ({
  publicKeyHex: "ab".repeat(32) as PublicKeyHex,
  encryptedPrivateKey: JSON.stringify({ v: 2, ciphertextB64: "cipher-only" }),
  username: "Demo User",
});

describe("download-identity-recovery-file", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds ciphertext-only recovery payload", () => {
    const payload = buildIdentityRecoveryFilePayload(sampleRecord(), "2026-11-01T00:00:00.000Z");
    expect(payload.schema).toBe(IDENTITY_RECOVERY_FILE_SCHEMA);
    expect(payload.exportedAt).toBe("2026-11-01T00:00:00.000Z");
    expect(payload.username).toBe("Demo User");
    expect(payload.publicKeyHex).toBe("ab".repeat(32));
    expect(payload.encryptedPrivateKey).toContain("cipher-only");
    expect(JSON.stringify(payload)).not.toMatch(/nsec1/i);
    expect(payload.encryptedPrivateKey).not.toMatch(/^[0-9a-f]{64}$/i);
  });

  it("sanitizes recovery file names", () => {
    expect(buildIdentityRecoveryFileName({
      username: "Demo User!!",
      publicKeyHex: "abcdef0123456789",
    })).toBe("obscur-identity-recovery-Demo-User-abcdef01.json");
  });

  it("downloads a JSON blob via an anchor click", () => {
    const createObjectURL = vi.fn(() => "blob:recovery");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });

    const anchor = document.createElement("a");
    const click = vi.spyOn(anchor, "click").mockImplementation(() => undefined);
    const createElement = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "a") {
        return anchor;
      }
      return Document.prototype.createElement.call(document, tagName);
    });
    const appendChild = vi.spyOn(document.body, "appendChild");

    const result = downloadIdentityRecoveryFile({ record: sampleRecord() });

    expect(result.fileName).toContain("obscur-identity-recovery-");
    expect(result.byteLength).toBeGreaterThan(20);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createElement).toHaveBeenCalledWith("a");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:recovery");
  });
});
