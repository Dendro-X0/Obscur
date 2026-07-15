"use client";

import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  buildProfileVaultRelativeDir,
  buildProfileVaultRelativePath,
  LEGACY_VAULT_MEDIA_DIR,
  resolveVaultStorageLayout,
} from "./local-media-vault-path";
import { nativeLocalMediaAdapter } from "./native-local-media-adapter";
import type { LocalMediaIndex } from "./vault-media-index-contract";
import { getObscurDataRootConfig } from "@/app/features/profiles/services/obscur-data-root-service";

export const VAULT_BLOB_URL_PREFIX = "obscur://vault/blob/" as const;
const STORAGE_CONFIG_KEY = "obscur.vault.local_media_storage_config";
const ENCRYPTED_VAULT_BLOB_FILE_NAME_PATTERN = /^[a-f0-9]{24}\.obscurvault$/i;

type LocalMediaStorageConfig = Readonly<{
  subdir: string;
}>;

const DEFAULT_SUBDIR = LEGACY_VAULT_MEDIA_DIR;

const readStorageSubdir = (profileId: string): string => {
  if (typeof window === "undefined") {
    return DEFAULT_SUBDIR;
  }
  try {
    const raw = localStorage.getItem(getScopedStorageKey(STORAGE_CONFIG_KEY, profileId));
    if (!raw) {
      return DEFAULT_SUBDIR;
    }
    const parsed = JSON.parse(raw) as { subdir?: unknown };
    if (typeof parsed.subdir === "string" && parsed.subdir.trim()) {
      return parsed.subdir.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    }
  } catch {
    // fall through
  }
  return DEFAULT_SUBDIR;
};

const isEncryptedVaultStorageFileName = (value: string): boolean =>
  ENCRYPTED_VAULT_BLOB_FILE_NAME_PATTERN.test(value.trim());

export const buildVaultBlobSyntheticUrl = (opaqueFileName: string): string => {
  const hex = opaqueFileName.replace(/\.obscurvault$/i, "").trim().toLowerCase();
  return `${VAULT_BLOB_URL_PREFIX}${hex}`;
};

export const isVaultBlobSyntheticUrl = (url: string): boolean =>
  url.trim().startsWith(VAULT_BLOB_URL_PREFIX);

export const isVaultStandaloneCatalogUrl = (url: string): boolean => {
  const trimmed = url.trim();
  return trimmed.startsWith("obscur://vault/local/") || isVaultBlobSyntheticUrl(trimmed);
};

const normalizeVaultRelativePathKey = (relativePath: string): string =>
  relativePath.replace(/\\/g, "/").trim().toLowerCase();

type VaultDiskScanTarget = Readonly<{
  relativeDir: string;
  appDataRelative: boolean;
}>;

const resolveVaultDiskScanTargets = async (
  profileId: string,
): Promise<ReadonlyArray<VaultDiskScanTarget>> => {
  const subdir = readStorageSubdir(profileId);
  const cfg: LocalMediaStorageConfig = { subdir };
  const targets: VaultDiskScanTarget[] = [
    {
      relativeDir: subdir || DEFAULT_SUBDIR,
      appDataRelative: true,
    },
  ];

  const effectivePath = (await getObscurDataRootConfig()).effectivePath?.trim() || null;
  const layout = resolveVaultStorageLayout({
    isNative: true,
    dataRootEffectivePath: effectivePath,
    config: { ...cfg, enabled: true, customRootPath: "", downloadRootPath: "", cacheSentFiles: true, cacheReceivedFiles: true },
  });
  if (layout.mode === "unified_data_root" && effectivePath) {
    targets.push({
      relativeDir: buildProfileVaultRelativeDir(profileId),
      appDataRelative: false,
    });
  }

  return targets;
};

const resolveDiskScanDirectoryRef = async (
  target: VaultDiskScanTarget,
  profileId: string,
): Promise<Readonly<{ path: string; appDataRelative?: boolean }>> => {
  if (target.appDataRelative) {
    return { path: target.relativeDir, appDataRelative: true };
  }
  const effectivePath = (await getObscurDataRootConfig()).effectivePath?.trim() || null;
  const subdir = readStorageSubdir(profileId);
  const layout = resolveVaultStorageLayout({
    isNative: true,
    dataRootEffectivePath: effectivePath,
    config: { subdir, enabled: true, customRootPath: "", downloadRootPath: "", cacheSentFiles: true, cacheReceivedFiles: true },
  });
  if (layout.mode === "unified_data_root" && effectivePath) {
    const profileDir = buildProfileVaultRelativeDir(profileId);
    const absolutePath = await nativeLocalMediaAdapter.joinPaths(effectivePath, profileDir);
    return { path: absolutePath };
  }
  const root = await nativeLocalMediaAdapter.getAppDataDirPath();
  if (!root) {
    return { path: target.relativeDir };
  }
  return { path: await nativeLocalMediaAdapter.joinPaths(root, target.relativeDir) };
};

/**
 * Authoritative vault listing from on-disk `.obscurvault` blobs.
 * Does not require SQLite or an active encryption session.
 */
export const scanVaultDiskBlobInventory = async (
  profileId?: string,
): Promise<LocalMediaIndex> => {
  if (!hasNativeRuntime()) {
    return {};
  }
  const resolvedProfileId = resolveVaultProfileId(profileId).trim() || "default";
  const inventory: LocalMediaIndex = {};
  const seenRelativePaths = new Set<string>();
  const targets = await resolveVaultDiskScanTargets(resolvedProfileId);

  for (const target of targets) {
    const directoryRef = await resolveDiskScanDirectoryRef(target, resolvedProfileId);
    const fileNames = await nativeLocalMediaAdapter.readDirectoryFileNames(
      directoryRef.appDataRelative
        ? { path: directoryRef.path, appDataRelative: true }
        : { path: directoryRef.path },
    );
    for (const fileName of fileNames) {
      if (!isEncryptedVaultStorageFileName(fileName)) {
        continue;
      }
      const relativePath = target.appDataRelative
        ? `${target.relativeDir}/${fileName}`
        : buildProfileVaultRelativePath(resolvedProfileId, fileName);
      const pathKey = normalizeVaultRelativePathKey(relativePath);
      if (seenRelativePaths.has(pathKey)) {
        continue;
      }
      seenRelativePaths.add(pathKey);
      const remoteUrl = buildVaultBlobSyntheticUrl(fileName);
      inventory[remoteUrl] = {
        remoteUrl,
        relativePath,
        savedAtUnixMs: Date.now(),
        fileName,
        contentType: "application/octet-stream",
        size: 0,
        explicitChatSave: true,
      };
    }
  }

  return inventory;
};
