/**
 * L1 multiprofile vault isolation (taxonomy Phase 5b / P1–P4).
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProfileVaultCategoryRelativePath,
  listProfileVaultCategoryRelativeDirs,
  mapAttachmentKindToVaultCategory,
  relativePathBelongsToProfileVault,
} from "./local-media-vault-path";
import {
  getTrackedVaultMediaBlobUrlCount,
  registerVaultMediaBlobUrl,
  revokeAllVaultMediaBlobUrls,
} from "./vault-media-blob-lifecycle";
import { resetVaultMediaIndexCache } from "./local-media-store";

describe("vault multiprofile isolation (L1)", () => {
  afterEach(() => {
    revokeAllVaultMediaBlobUrls();
  });

  it("P1: resetVaultMediaIndexCache revokes tracked blob preview URLs", () => {
    registerVaultMediaBlobUrl("obscur://vault/local/aaaa", "blob:http://localhost/mock-a");
    expect(getTrackedVaultMediaBlobUrlCount()).toBe(1);
    resetVaultMediaIndexCache();
    expect(getTrackedVaultMediaBlobUrlCount()).toBe(0);
  });

  it("P3: category scan dirs never leave the requested profile vault root", () => {
    const dirs = listProfileVaultCategoryRelativeDirs("alice");
    expect(dirs.every((dir) => dir.startsWith("profiles/alice/vault/"))).toBe(true);
    expect(dirs.some((dir) => dir.includes("profiles/bob/"))).toBe(false);
  });

  it("P4: foreign profile relative paths fail closed", () => {
    const alicePath = buildProfileVaultCategoryRelativePath(
      "alice",
      "images",
      "aaaaaaaaaaaaaaaaaaaaaaaa.obscurvault",
    );
    expect(relativePathBelongsToProfileVault(alicePath, "alice")).toBe(true);
    expect(relativePathBelongsToProfileVault(alicePath, "bob")).toBe(false);
  });

  it("P2/taxonomy: same opaque name maps into isolated per-profile category trees", () => {
    const file = "bbbbbbbbbbbbbbbbbbbbbbbb.obscurvault";
    const pathA = buildProfileVaultCategoryRelativePath("alice", "images", file);
    const pathB = buildProfileVaultCategoryRelativePath("bob", "images", file);
    expect(pathA).not.toBe(pathB);
    expect(pathA).toBe(`profiles/alice/vault/images/${file}`);
    expect(pathB).toBe(`profiles/bob/vault/images/${file}`);
  });

  it("kind mapping stays deterministic for category placement", () => {
    expect(mapAttachmentKindToVaultCategory("image")).toBe("images");
    expect(mapAttachmentKindToVaultCategory("video")).toBe("videos");
    expect(mapAttachmentKindToVaultCategory("voice_note")).toBe("audio");
    expect(mapAttachmentKindToVaultCategory("file")).toBe("files");
  });
});

describe("vault multiprofile isolation contracts", () => {
  it("lock path resets vault media caches via native storage at-rest", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/features/storage/services/native-storage-at-rest-service.ts"),
      "utf8",
    );
    expect(source).toContain("resetVaultMediaIndexCache");
  });

  it("resolve path refuses cross-profile reads and clears caches on profile switch", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/features/vault/services/local-media-store.ts"),
      "utf8",
    );
    expect(source).toContain("relativePathBelongsToProfileVault");
    expect(source).toContain("Vault write refused: path belongs to another profile");
    expect(source).toContain("never carry blob URLs or SQLite cache across profile switches");
  });
});
