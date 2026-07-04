import { describe, expect, it } from "vitest";
import { DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG } from "./local-media-store";
import { resolveVaultStorageLayout, vaultUsesAbsolutePaths } from "./local-media-vault-path";

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
