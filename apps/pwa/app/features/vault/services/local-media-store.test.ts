import { describe, expect, it } from "vitest";
import {
  buildLocalVaultOnlyUrl,
  isEncryptedVaultStorageFileName,
  isLocalVaultOnlyUrl,
  isVaultEncryptionSessionReady,
  isLegacyPlaintextVaultIndexEntry,
  normalizeLocalMediaDisplayFileName,
  resolveVaultDisplayFileName,
  shouldAllowLocalMediaCacheWrite,
  DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG,
} from "./local-media-store";
import { VaultWriteEncryptionRequiredError } from "@/app/features/storage/services/vault-at-rest";

describe("local vault URL helpers", () => {
  it("builds and detects local-only vault URLs", () => {
    const url = buildLocalVaultOnlyUrl("abc123");
    expect(url).toBe("obscur://vault/local/abc123");
    expect(isLocalVaultOnlyUrl(url)).toBe(true);
    expect(isLocalVaultOnlyUrl("https://image.nostr.build/x")).toBe(false);
  });
});

describe("resolveVaultDisplayFileName", () => {
  it("prefers attachment names over encrypted blob storage names", () => {
    expect(resolveVaultDisplayFileName({
      attachmentFileName: "storm-photo.jpg",
      indexFileName: "bf2f9ab5d641772b682a1df5.obscurvault",
      relativePath: "vault-media/bf2f9ab5d641772b682a1df5.obscurvault",
    })).toBe("storm-photo.jpg");
    expect(isEncryptedVaultStorageFileName("bf2f9ab5d641772b682a1df5.obscurvault")).toBe(true);
  });

  it("falls back to index file name when attachment name is missing", () => {
    expect(resolveVaultDisplayFileName({
      indexFileName: "meeting-notes.pdf",
      relativePath: "vault-media/bf2f9ab5d641772b682a1df5.obscurvault",
    })).toBe("meeting-notes.pdf");
  });
});

describe("normalizeLocalMediaDisplayFileName", () => {
  it("strips legacy hashed cache prefixes", () => {
    expect(
      normalizeLocalMediaDisplayFileName("1773599289052-7c5c224c67561c473a5fd14c-kontraa-no-sleep-hiphop-music-473847.mp3"),
    ).toBe("kontraa-no-sleep-hiphop-music-473847.mp3");
  });

  it("keeps regular file names unchanged", () => {
    expect(normalizeLocalMediaDisplayFileName("meeting-notes.pdf")).toBe("meeting-notes.pdf");
  });
});

describe("shouldAllowLocalMediaCacheWrite", () => {
  it("allows explicit vault saves even when automatic local caching is disabled", () => {
    const disabledConfig = { ...DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG, enabled: false };
    expect(shouldAllowLocalMediaCacheWrite(disabledConfig)).toBe(false);
    expect(shouldAllowLocalMediaCacheWrite(disabledConfig, { force: true })).toBe(true);
  });
});

describe("vault encryption session gate", () => {
  it("exposes session readiness for vault writes", () => {
    expect(typeof isVaultEncryptionSessionReady()).toBe("boolean");
  });

  it("uses the vault write encryption required error for locked saves", () => {
    const error = new VaultWriteEncryptionRequiredError();
    expect(error.code).toBe("VAULT_WRITE_ENCRYPTION_REQUIRED");
    expect(error.message).toContain("Unlock this profile");
  });

  it("detects legacy plaintext vault index entries", () => {
    expect(isLegacyPlaintextVaultIndexEntry({ relativePath: "vault-media/photo.jpg" })).toBe(true);
    expect(isLegacyPlaintextVaultIndexEntry({
      relativePath: "vault-media/bf2f9ab5d641772b682a1df5.obscurvault",
    })).toBe(false);
  });
});
