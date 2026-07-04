import type { LocalMediaStorageConfig } from "./local-media-store";

export type VaultStorageLayoutMode =
  | "unified_data_root"
  | "legacy_custom_root"
  | "app_data_relative";

export type VaultStorageLayout = Readonly<{
  mode: VaultStorageLayoutMode;
  absoluteRoot: string | null;
}>;

export const resolveVaultStorageLayout = (params: Readonly<{
  isNative: boolean;
  dataRootEffectivePath: string | null;
  config: LocalMediaStorageConfig;
}>): VaultStorageLayout => {
  const effectivePath = params.dataRootEffectivePath?.trim() ?? "";
  if (params.isNative && effectivePath.length > 0) {
    return {
      mode: "unified_data_root",
      absoluteRoot: null,
    };
  }
  const customRoot = params.config.customRootPath.trim();
  if (customRoot.length > 0) {
    return {
      mode: "legacy_custom_root",
      absoluteRoot: null,
    };
  }
  return {
    mode: "app_data_relative",
    absoluteRoot: null,
  };
};

export const vaultUsesAbsolutePaths = (layout: VaultStorageLayout): boolean =>
  layout.mode === "unified_data_root" || layout.mode === "legacy_custom_root";
