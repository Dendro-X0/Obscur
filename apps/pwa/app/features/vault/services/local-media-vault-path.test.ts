import { describe, expect, it } from "vitest";
import { DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG } from "./local-media-store";
import {
  buildProfileVaultRelativeDir,
  buildProfileVaultRelativePath,
  isLegacyFlatVaultRelativePath,
  isLegacyVaultLayoutIndexEntry,
  isProfileScopedVaultRelativePath,
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

  it("detects legacy flat vault-media paths", () => {
    expect(isLegacyFlatVaultRelativePath("vault-media/photo.obscurvault")).toBe(true);
    expect(isLegacyFlatVaultRelativePath("D:/Obscur/vault-media/photo.obscurvault")).toBe(true);
    expect(isProfileScopedVaultRelativePath("profiles/default/vault/photo.obscurvault")).toBe(true);
    expect(isLegacyVaultLayoutIndexEntry({ relativePath: "vault-media/photo.obscurvault" })).toBe(true);
    expect(isLegacyVaultLayoutIndexEntry({ relativePath: "profiles/default/vault/photo.obscurvault" })).toBe(false);
  });
});
