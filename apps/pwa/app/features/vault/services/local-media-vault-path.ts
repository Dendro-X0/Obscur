import type { LocalMediaStorageConfig } from "./local-media-store";

export const PROFILE_VAULT_PARENT_DIR = "profiles";
export const PROFILE_VAULT_SUBDIR = "vault";
export const LEGACY_VAULT_MEDIA_DIR = "vault-media";

/** Stable on-disk category slugs under `profiles/{id}/vault/` (Phase 5b). */
export const VAULT_CATEGORY_SLUGS = ["images", "videos", "audio", "files"] as const;
export type VaultCategorySlug = (typeof VAULT_CATEGORY_SLUGS)[number];

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

const normalizeRelativePath = (relativePath: string): string =>
  relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();

export const sanitizeProfileVaultId = (profileId: string): string => {
  const trimmed = profileId.trim();
  if (!trimmed) {
    return "default";
  }
  const cleaned = trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  return cleaned.length > 0 ? cleaned : "default";
};

export const isVaultCategorySlug = (value: string): value is VaultCategorySlug =>
  (VAULT_CATEGORY_SLUGS as ReadonlyArray<string>).includes(value.trim().toLowerCase());

/**
 * Maps attachment / UI kinds onto on-disk category folders.
 * Unknown kinds land in `files/` (recoverable default).
 */
export const mapAttachmentKindToVaultCategory = (kind: string | undefined | null): VaultCategorySlug => {
  const normalized = (kind ?? "").trim().toLowerCase();
  if (normalized === "image") {
    return "images";
  }
  if (normalized === "video") {
    return "videos";
  }
  if (normalized === "audio" || normalized === "voice_note") {
    return "audio";
  }
  return "files";
};

export const buildProfileVaultRelativeDir = (profileId: string): string =>
  `${PROFILE_VAULT_PARENT_DIR}/${sanitizeProfileVaultId(profileId)}/${PROFILE_VAULT_SUBDIR}`;

export const buildProfileVaultCategoryRelativeDir = (
  profileId: string,
  category: VaultCategorySlug,
): string => `${buildProfileVaultRelativeDir(profileId)}/${category}`;

/** Flat Phase-5 path (no category). Prefer {@link buildProfileVaultCategoryRelativePath} for new writes. */
export const buildProfileVaultRelativePath = (
  profileId: string,
  fileName: string,
): string => `${buildProfileVaultRelativeDir(profileId)}/${fileName.trim()}`;

export const buildProfileVaultCategoryRelativePath = (
  profileId: string,
  category: VaultCategorySlug,
  fileName: string,
): string => `${buildProfileVaultCategoryRelativeDir(profileId, category)}/${fileName.trim()}`;

export const isProfileScopedVaultRelativePath = (relativePath: string): boolean => {
  const normalized = normalizeRelativePath(relativePath).toLowerCase();
  return normalized.startsWith(`${PROFILE_VAULT_PARENT_DIR}/`)
    && normalized.includes(`/${PROFILE_VAULT_SUBDIR}/`);
};

/** Phase-5 flat blob: `profiles/{id}/vault/{file}` with no category segment. */
export const isFlatProfileVaultBlobRelativePath = (relativePath: string): boolean => {
  const normalized = normalizeRelativePath(relativePath);
  const match = normalized.match(
    new RegExp(`^${PROFILE_VAULT_PARENT_DIR}/([^/]+)/${PROFILE_VAULT_SUBDIR}/([^/]+)$`, "i"),
  );
  if (!match?.[2]) {
    return false;
  }
  return !isVaultCategorySlug(match[2]);
};

export const extractVaultCategoryFromRelativePath = (
  relativePath: string,
): VaultCategorySlug | null => {
  const normalized = normalizeRelativePath(relativePath);
  const match = normalized.match(
    new RegExp(
      `^${PROFILE_VAULT_PARENT_DIR}/[^/]+/${PROFILE_VAULT_SUBDIR}/([^/]+)/[^/]+$`,
      "i",
    ),
  );
  const slug = match?.[1]?.toLowerCase() ?? "";
  return isVaultCategorySlug(slug) ? slug : null;
};

/**
 * Fail-closed: relative path must belong to the active profile's vault tree.
 * Accepts both flat Phase-5 and categorized Phase-5b paths.
 */
export const relativePathBelongsToProfileVault = (
  relativePath: string,
  profileId: string,
): boolean => {
  if (!isProfileScopedVaultRelativePath(relativePath)) {
    return false;
  }
  const expectedPrefix = `${buildProfileVaultRelativeDir(profileId)}/`.toLowerCase();
  const normalized = `${normalizeRelativePath(relativePath).toLowerCase()}/`;
  return normalized.startsWith(expectedPrefix)
    || normalizeRelativePath(relativePath).toLowerCase() === buildProfileVaultRelativeDir(profileId).toLowerCase();
};

export const listProfileVaultCategoryRelativeDirs = (profileId: string): ReadonlyArray<string> =>
  VAULT_CATEGORY_SLUGS.map((category) => buildProfileVaultCategoryRelativeDir(profileId, category));

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
