import type { LocalMediaStorageConfig } from "./local-media-store";

export const PROFILE_VAULT_PARENT_DIR = "profiles";
export const PROFILE_VAULT_SUBDIR = "vault";
export const LEGACY_VAULT_MEDIA_DIR = "vault-media";

export type VaultStorageLayoutMode =
  | "unified_data_root"
  | "legacy_custom_root"
  | "app_data_relative";

export type VaultStorageLayout = Readonly<{
  mode: VaultStorageLayoutMode;
  absoluteRoot: string | null;
}>;

const isAbsoluteStoragePath = (path: string): boolean =>
  /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("/") || path.startsWith("\\\\");

export const sanitizeProfileVaultId = (profileId: string): string => {
  const trimmed = profileId.trim();
  if (!trimmed) {
    return "default";
  }
  const cleaned = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  return cleaned.length > 0 ? cleaned : "default";
};

export const buildProfileVaultRelativeDir = (profileId: string): string =>
  `${PROFILE_VAULT_PARENT_DIR}/${sanitizeProfileVaultId(profileId)}/${PROFILE_VAULT_SUBDIR}`;

export const buildProfileVaultRelativePath = (
  profileId: string,
  fileName: string,
): string => `${buildProfileVaultRelativeDir(profileId)}/${fileName.trim()}`;

export const isProfileScopedVaultRelativePath = (relativePath: string): boolean => {
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  return normalized.startsWith(`${PROFILE_VAULT_PARENT_DIR}/`)
    && normalized.includes(`/${PROFILE_VAULT_SUBDIR}/`);
};

export const isLegacyFlatVaultRelativePath = (relativePath: string): boolean => {
  const normalized = relativePath.replace(/\\/g, "/");
  if (isAbsoluteStoragePath(normalized)) {
    const lower = normalized.toLowerCase();
    return lower.includes(`/${LEGACY_VAULT_MEDIA_DIR}/`)
      || lower.endsWith(`/${LEGACY_VAULT_MEDIA_DIR}`);
  }
  const lower = normalized.toLowerCase();
  return lower === LEGACY_VAULT_MEDIA_DIR || lower.startsWith(`${LEGACY_VAULT_MEDIA_DIR}/`);
};

export const isDataRootRelativeVaultPath = (relativePath: string): boolean =>
  isProfileScopedVaultRelativePath(relativePath) || isLegacyFlatVaultRelativePath(relativePath);

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
  if (params.isNative && customRoot.length > 0) {
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

export const isLegacyVaultLayoutIndexEntry = (entry: Readonly<{ relativePath: string }>): boolean => {
  if (isProfileScopedVaultRelativePath(entry.relativePath)) {
    return false;
  }
  return isLegacyFlatVaultRelativePath(entry.relativePath);
};

export const extractVaultBlobFileName = (relativePath: string): string => {
  const normalized = relativePath.replace(/\\/g, "/");
  const segment = normalized.split("/").filter(Boolean).pop() ?? "";
  return segment.trim();
};
