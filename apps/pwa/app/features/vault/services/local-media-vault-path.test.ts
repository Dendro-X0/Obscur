import { describe, expect, it } from "vitest";
import { DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG } from "./local-media-store";
import {
  buildProfileVaultCategoryRelativeDir,
  buildProfileVaultCategoryRelativePath,
  buildProfileVaultRelativeDir,
  buildProfileVaultRelativePath,
  extractVaultCategoryFromRelativePath,
  isFlatProfileVaultBlobRelativePath,
  isLegacyFlatVaultRelativePath,
  isLegacyVaultLayoutIndexEntry,
  isProfileScopedVaultRelativePath,
  listProfileVaultCategoryRelativeDirs,
  mapAttachmentKindToVaultCategory,
  relativePathBelongsToProfileVault,
  resolveVaultStorageLayout,
  vaultUsesAbsolutePaths,
} from "./local-media-vault-path";

describe("resolveVaultStorageLayout", () => {
  it("prefers unified data root on native desktop", () => {
    const layout = resolveVaultStorageLayout({
      isNative: true,
      dataRootEffectivePath: "D:\\ObscurData",
      config: { ...DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG, customRootPath: "E:\\LegacyVault" },
    });
    expect(layout.mode).toBe("unified_data_root");
    expect(vaultUsesAbsolutePaths(layout)).toBe(true);
  });

  it("falls back to legacy custom root when data root is unavailable", () => {
    const layout = resolveVaultStorageLayout({
      isNative: true,
      dataRootEffectivePath: "",
      config: { ...DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG, customRootPath: "E:\\LegacyVault" },
    });
    expect(layout.mode).toBe("legacy_custom_root");
  });

  it("uses app-data-relative layout on web", () => {
    const layout = resolveVaultStorageLayout({
      isNative: false,
      dataRootEffectivePath: null,
      config: DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG,
    });
    expect(layout.mode).toBe("app_data_relative");
    expect(vaultUsesAbsolutePaths(layout)).toBe(false);
  });
});

describe("profile vault relative paths", () => {
  it("builds per-profile vault directories", () => {
    expect(buildProfileVaultRelativeDir("default")).toBe("profiles/default/vault");
    expect(buildProfileVaultRelativePath("alpha", "bf2f9ab5d641772b682a1df5.obscurvault"))
      .toBe("profiles/alpha/vault/bf2f9ab5d641772b682a1df5.obscurvault");
  });

  it("builds category subdirectories under the profile vault", () => {
    expect(buildProfileVaultCategoryRelativeDir("alpha", "images")).toBe("profiles/alpha/vault/images");
    expect(
      buildProfileVaultCategoryRelativePath("alpha", "videos", "bf2f9ab5d641772b682a1df5.obscurvault"),
    ).toBe("profiles/alpha/vault/videos/bf2f9ab5d641772b682a1df5.obscurvault");
    expect(listProfileVaultCategoryRelativeDirs("alpha")).toEqual([
      "profiles/alpha/vault/images",
      "profiles/alpha/vault/videos",
      "profiles/alpha/vault/audio",
      "profiles/alpha/vault/files",
    ]);
  });

  it("maps attachment kinds onto category slugs", () => {
    expect(mapAttachmentKindToVaultCategory("image")).toBe("images");
    expect(mapAttachmentKindToVaultCategory("video")).toBe("videos");
    expect(mapAttachmentKindToVaultCategory("audio")).toBe("audio");
    expect(mapAttachmentKindToVaultCategory("voice_note")).toBe("audio");
    expect(mapAttachmentKindToVaultCategory("file")).toBe("files");
    expect(mapAttachmentKindToVaultCategory("unknown")).toBe("files");
  });

  it("detects flat vs categorized profile vault blobs", () => {
    const flat = "profiles/default/vault/bf2f9ab5d641772b682a1df5.obscurvault";
    const categorized = "profiles/default/vault/images/bf2f9ab5d641772b682a1df5.obscurvault";
    expect(isFlatProfileVaultBlobRelativePath(flat)).toBe(true);
    expect(isFlatProfileVaultBlobRelativePath(categorized)).toBe(false);
    expect(extractVaultCategoryFromRelativePath(categorized)).toBe("images");
    expect(extractVaultCategoryFromRelativePath(flat)).toBeNull();
  });

  it("fail-closes paths that belong to another profile", () => {
    const pathA = "profiles/alice/vault/images/bf2f9ab5d641772b682a1df5.obscurvault";
    expect(relativePathBelongsToProfileVault(pathA, "alice")).toBe(true);
    expect(relativePathBelongsToProfileVault(pathA, "bob")).toBe(false);
    expect(relativePathBelongsToProfileVault("vault-media/x.obscurvault", "alice")).toBe(false);
  });

  it("detects legacy flat vault-media paths", () => {
    expect(isLegacyFlatVaultRelativePath("vault-media/photo.obscurvault")).toBe(true);
    expect(isLegacyFlatVaultRelativePath("D:/Obscur/vault-media/photo.obscurvault")).toBe(true);
    expect(isProfileScopedVaultRelativePath("profiles/default/vault/photo.obscurvault")).toBe(true);
    expect(isProfileScopedVaultRelativePath("profiles/default/vault/images/photo.obscurvault")).toBe(true);
    expect(isLegacyVaultLayoutIndexEntry({ relativePath: "vault-media/photo.obscurvault" })).toBe(true);
    expect(isLegacyVaultLayoutIndexEntry({ relativePath: "profiles/default/vault/photo.obscurvault" })).toBe(false);
  });
});
