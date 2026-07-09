/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countLegacyPlaintextVaultIndexEntries,
  getVaultLegacyMigrationProgress,
  listLegacyPlaintextVaultIndexRemoteUrls,
  runVaultLegacyPlaintextMigration,
} from "./vault-legacy-migration";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

vi.mock("@/app/features/storage/services/vault-at-rest", () => ({
  isVaultWriteEncryptionReady: vi.fn(() => true),
}));

const migrateLegacyPlaintextVaultIndexEntry = vi.fn();
const getLocalMediaIndexSnapshot = vi.fn();

vi.mock("./local-media-store", () => ({
  getLocalMediaIndexSnapshot: (...args: unknown[]) => getLocalMediaIndexSnapshot(...args),
  isLegacyPlaintextVaultIndexEntry: (entry: Readonly<{ relativePath: string }>) =>
    !entry.relativePath.toLowerCase().endsWith(".obscurvault"),
  migrateLegacyPlaintextVaultIndexEntry: (...args: unknown[]) => migrateLegacyPlaintextVaultIndexEntry(...args),
}));

describe("vault-legacy-migration", () => {
  beforeEach(() => {
    migrateLegacyPlaintextVaultIndexEntry.mockReset();
    getLocalMediaIndexSnapshot.mockReset();
  });

  it("lists legacy plaintext index entries by relative path", () => {
    getLocalMediaIndexSnapshot.mockReturnValue({
      "https://cdn.example.com/a.jpg": {
        remoteUrl: "https://cdn.example.com/a.jpg",
        relativePath: "vault-media/photo.jpg",
        savedAtUnixMs: 1,
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        size: 10,
      },
      "obscur://vault/local/abc": {
        remoteUrl: "obscur://vault/local/abc",
        relativePath: "vault-media/bf2f9ab5d641772b682a1df5.obscurvault",
        savedAtUnixMs: 2,
        fileName: "clip.mp4",
        contentType: "video/mp4",
        size: 20,
      },
    });

    expect(listLegacyPlaintextVaultIndexRemoteUrls()).toEqual(["https://cdn.example.com/a.jpg"]);
    expect(countLegacyPlaintextVaultIndexEntries()).toBe(1);
  });

  it("migrates each legacy entry and reports summary counts", async () => {
    getLocalMediaIndexSnapshot.mockReturnValue({
      "https://cdn.example.com/a.jpg": {
        remoteUrl: "https://cdn.example.com/a.jpg",
        relativePath: "vault-media/photo.jpg",
        savedAtUnixMs: 1,
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        size: 10,
      },
      "obscur://vault/local/abc": {
        remoteUrl: "obscur://vault/local/abc",
        relativePath: "vault-media/legacy.mp4",
        savedAtUnixMs: 2,
        fileName: "legacy.mp4",
        contentType: "video/mp4",
        size: 20,
      },
    });
    migrateLegacyPlaintextVaultIndexEntry
      .mockResolvedValueOnce("migrated")
      .mockResolvedValueOnce("missing_file");

    const summary = await runVaultLegacyPlaintextMigration();
    expect(summary).toEqual({
      pending: 2,
      migrated: 1,
      alreadyEncrypted: 0,
      missingFile: 1,
      failed: 0,
    });
    expect(migrateLegacyPlaintextVaultIndexEntry).toHaveBeenCalledTimes(2);
    expect(getVaultLegacyMigrationProgress().status).toBe("complete");
  });
});
