"use client";

import type { Attachment, AttachmentKind } from "../../messaging/types";
import { getMediaKindForPolicy } from "../../messaging/lib/media-upload-policy";
import { pruneLocalMediaIndexRetentionEntries } from "@/app/features/runtime/services/self-cleaning-retention-sweep-policy";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getObscurDataRootConfig } from "@/app/features/profiles/services/obscur-data-root-service";
import { nativeLocalMediaAdapter } from "./native-local-media-adapter";
import {
  resolveVaultStorageLayout,
  vaultUsesAbsolutePaths,
  buildProfileVaultRelativeDir,
  buildProfileVaultCategoryRelativePath,
  isDataRootRelativeVaultPath,
  isLegacyVaultLayoutIndexEntry,
  isFlatProfileVaultBlobRelativePath,
  isProfileScopedVaultRelativePath,
  extractVaultBlobFileName,
  extractVaultCategoryFromRelativePath,
  mapAttachmentKindToVaultCategory,
  listProfileVaultCategoryRelativeDirs,
  relativePathBelongsToProfileVault,
  LEGACY_VAULT_MEDIA_DIR,
} from "./local-media-vault-path";
import {
  buildOpaqueVaultFileName,
  decryptVaultFileBytesIfNeeded,
  encryptVaultBytesForWrite,
  isEncryptedVaultRelativePath,
  isVaultWriteEncryptionReady,
  resolveVaultProfileId,
  VaultWriteEncryptionRequiredError,
} from "@/app/features/storage/services/vault-at-rest";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { normalizeAttachmentUrl } from "@/app/shared/public-url";
import { scanVaultDiskBlobInventory } from "./vault-disk-inventory";
import type { LocalMediaIndex, LocalMediaIndexEntry } from "./vault-media-index-contract";
import {
  deleteAllVaultMediaIndexEntriesFromSqlite,
  deleteVaultMediaIndexEntryFromSqlite,
  loadVaultMediaIndexMapFromSqlite,
  persistVaultMediaIndexSnapshotToSqlite,
  upsertVaultMediaIndexEntryToSqlite,
  usesSqliteVaultMediaIndex,
} from "./vault-media-index-sqlite-store";
import {
  registerVaultMediaBlobUrl,
  revokeAllVaultMediaBlobUrls,
  revokeVaultMediaBlobUrl,
} from "./vault-media-blob-lifecycle";

export type { LocalMediaIndexEntry, LocalMediaIndex } from "./vault-media-index-contract";

export type LocalMediaStorageConfig = Readonly<{
    enabled: boolean;
    subdir: string;
    customRootPath: string;
    downloadRootPath: string;
    cacheSentFiles: boolean;
    cacheReceivedFiles: boolean;
}>;

export type LocalMediaCacheItem = Readonly<{
    remoteUrl: string;
    localUrl: string;
    relativePath: string;
    savedAtUnixMs: number;
    fileName: string;
    contentType: string;
    size: number;
}>;

const STORAGE_CONFIG_KEY = "obscur.vault.local_media_storage_config";
const STORAGE_INDEX_KEY = "obscur.vault.local_media_index";
const DEFAULT_SUBDIR = "vault-media";

export const LOCAL_VAULT_URL_PREFIX = "obscur://vault/local/" as const;

export const isLocalVaultOnlyUrl = (url: string): boolean =>
    url.trim().startsWith(LOCAL_VAULT_URL_PREFIX);

export const buildLocalVaultOnlyUrl = (contentSha256Hex: string): string =>
    `${LOCAL_VAULT_URL_PREFIX}${contentSha256Hex.trim().toLowerCase()}`;

export type SaveFileToLocalVaultResult = Readonly<{
    vaultUrl: string;
    localUrl: string;
    attachment: Attachment;
}>;

const inferAttachmentKindFromMeta = (fileName: string, contentType: string): AttachmentKind => {
    const fakeFile = new File([], fileName, { type: contentType });
    return getMediaKindForPolicy(fakeFile);
};

const sha256BytesHex = async (bytes: Uint8Array): Promise<string> => {
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
};
let localCacheWriteBlocked = false;
let localCacheBlockedWarningEmitted = false;
let vaultIndexCache: LocalMediaIndex = {};
let vaultIndexCacheHydrated = false;
let vaultIndexCacheProfileId: string | null = null;
let vaultDiskInventoryCache: LocalMediaIndex = {};
let vaultDiskInventoryProfileId: string | null = null;

const normalizeVaultRelativePathKey = (relativePath: string): string =>
  relativePath.replace(/\\/g, "/").trim().toLowerCase();

const mergeDiskAndSqliteVaultIndex = (
  diskIndex: LocalMediaIndex,
  sqliteIndex: LocalMediaIndex,
): LocalMediaIndex => {
  const sqliteRelativePaths = new Set(
    Object.values(sqliteIndex)
      .map((entry) => entry?.relativePath?.trim())
      .filter((value): value is string => Boolean(value))
      .map(normalizeVaultRelativePathKey),
  );
  const merged: LocalMediaIndex = { ...sqliteIndex };
  Object.entries(diskIndex).forEach(([remoteUrl, entry]) => {
    const relativePath = entry?.relativePath?.trim();
    if (!relativePath) {
      return;
    }
    if (sqliteRelativePaths.has(normalizeVaultRelativePathKey(relativePath))) {
      return;
    }
    merged[remoteUrl] = entry;
  });
  return merged;
};

const readDiskInventoryForActiveProfile = (): LocalMediaIndex => {
  const profileId = resolveVaultProfileId().trim();
  if (!profileId || vaultDiskInventoryProfileId !== profileId) {
    return {};
  }
  return vaultDiskInventoryCache;
};

const LOCAL_MEDIA_INDEX_CHANGED_EVENT = "obscur:local-media-index-changed";

export const emitLocalMediaIndexChanged = (): void => {
    if (!isBrowser()) {
        return;
    }
    window.dispatchEvent(new CustomEvent(LOCAL_MEDIA_INDEX_CHANGED_EVENT));
};

export const subscribeLocalMediaIndexChanged = (handler: () => void): (() => void) => {
    if (!isBrowser()) {
        return () => undefined;
    }
    window.addEventListener(LOCAL_MEDIA_INDEX_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LOCAL_MEDIA_INDEX_CHANGED_EVENT, handler);
};

export const shouldAllowLocalMediaCacheWrite = (
    config: LocalMediaStorageConfig,
    options?: Readonly<{ force?: boolean }>,
): boolean => options?.force === true || config.enabled;

export const DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG: LocalMediaStorageConfig = {
    enabled: true,
    subdir: DEFAULT_SUBDIR,
    customRootPath: "",
    downloadRootPath: "",
    cacheSentFiles: true,
    cacheReceivedFiles: true,
};

const isAbsoluteStoragePath = (path: string): boolean =>
    /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("/") || path.startsWith("\\\\");

type ResolvedVaultStorage = Readonly<{
    absoluteStorageDir: string | null;
    usesAbsolutePaths: boolean;
    unifiedDataRootPath: string | null;
    profileVaultRelativeDir: string | null;
}>;

const resolveVaultStorage = async (): Promise<ResolvedVaultStorage> => {
    const cfg = getLocalMediaStorageConfig();
    const profileId = resolveVaultProfileId().trim() || "default";
    const effectivePath = isTauriRuntime()
        ? (await getObscurDataRootConfig()).effectivePath?.trim() || null
        : null;
    const layout = resolveVaultStorageLayout({
        isNative: isTauriRuntime(),
        dataRootEffectivePath: effectivePath,
        config: cfg,
    });
    let absoluteStorageDir: string | null = null;
    let profileVaultRelativeDir: string | null = null;
    if (layout.mode === "unified_data_root" && effectivePath) {
        profileVaultRelativeDir = buildProfileVaultRelativeDir(profileId);
        absoluteStorageDir = await nativeLocalMediaAdapter.joinPaths(effectivePath, profileVaultRelativeDir);
    } else if (layout.mode === "legacy_custom_root") {
        absoluteStorageDir = await nativeLocalMediaAdapter.joinPaths(cfg.customRootPath, cfg.subdir);
    }
    return {
        absoluteStorageDir,
        usesAbsolutePaths: vaultUsesAbsolutePaths(layout),
        unifiedDataRootPath: layout.mode === "unified_data_root" ? effectivePath : null,
        profileVaultRelativeDir,
    };
};

const resolveEntryAbsolutePath = async (entryPath: string): Promise<string> => {
    if (isAbsoluteStoragePath(entryPath)) {
        return entryPath;
    }
    const storage = await resolveVaultStorage();
    if (storage.unifiedDataRootPath || isDataRootRelativeVaultPath(entryPath)) {
        const root = storage.unifiedDataRootPath ?? await nativeLocalMediaAdapter.getAppDataDirPath();
        if (!root) {
            throw new Error("Native local media path is unavailable");
        }
        return nativeLocalMediaAdapter.joinPaths(root, entryPath);
    }
    return buildAbsolutePath(entryPath);
};

const resolveEntryStorageRef = async (entryPath: string): Promise<Readonly<{ path: string; appDataRelative?: boolean }>> => {
    if (isAbsoluteStoragePath(entryPath)) {
        return { path: entryPath };
    }
    const storage = await resolveVaultStorage();
    if (storage.unifiedDataRootPath || isDataRootRelativeVaultPath(entryPath)) {
        return { path: await resolveEntryAbsolutePath(entryPath) };
    }
    return { path: entryPath, appDataRelative: true };
};

const writeVaultBytesToEntryPath = async (entryPath: string, bytes: Uint8Array): Promise<void> => {
    const profileId = resolveVaultProfileId().trim() || "default";
    if (
        isDataRootRelativeVaultPath(entryPath)
        && isProfileScopedVaultRelativePath(entryPath)
        && !relativePathBelongsToProfileVault(entryPath, profileId)
    ) {
        throw new Error("Vault write refused: path belongs to another profile");
    }
    await ensureVaultEntryParentDir(entryPath);
    const target = await resolveEntryStorageRef(entryPath);
    if (target.appDataRelative) {
        await nativeLocalMediaAdapter.writeBytes({ path: target.path, appDataRelative: true, bytes });
        return;
    }
    await nativeLocalMediaAdapter.writeBytes({ path: target.path, bytes });
};

const isTauriRuntime = (): boolean => {
    return hasNativeRuntime();
};

const isBrowser = (): boolean => typeof window !== "undefined";

const scopedConfigKey = (profileId?: string): string => getScopedStorageKey(STORAGE_CONFIG_KEY, profileId);
const scopedIndexKey = (profileId?: string): string => getScopedStorageKey(STORAGE_INDEX_KEY, profileId);

export const getVaultMediaIndexLocalStorageKey = (profileId?: string): string => scopedIndexKey(profileId);

export const resetVaultMediaIndexCache = (): void => {
  vaultIndexCache = {};
  vaultIndexCacheHydrated = false;
  vaultIndexCacheProfileId = null;
  vaultDiskInventoryCache = {};
  vaultDiskInventoryProfileId = null;
  revokeAllVaultMediaBlobUrls();
};

export const hydrateVaultMediaIndexCacheFromSqlite = async (profileId?: string): Promise<boolean> => {
  if (!usesSqliteVaultMediaIndex()) {
    return false;
  }
  const resolvedProfileId = resolveVaultProfileId(profileId).trim();
  if (!resolvedProfileId) {
    return false;
  }
  try {
    vaultIndexCache = await loadVaultMediaIndexMapFromSqlite(resolvedProfileId);
    vaultIndexCacheHydrated = true;
    vaultIndexCacheProfileId = resolvedProfileId;
    emitLocalMediaIndexChanged();
    return true;
  } catch (error) {
    console.warn("[VaultMediaIndex] SQLite hydrate failed (disk inventory still authoritative):", error);
    return false;
  }
};

export const hydrateVaultDiskInventoryForActiveProfile = async (profileId?: string): Promise<number> => {
  const resolvedProfileId = resolveVaultProfileId(profileId).trim();
  if (!resolvedProfileId || !isTauriRuntime()) {
    vaultDiskInventoryCache = {};
    vaultDiskInventoryProfileId = null;
    return 0;
  }
  if (vaultDiskInventoryProfileId !== resolvedProfileId) {
    vaultDiskInventoryCache = {};
  }
  vaultDiskInventoryCache = await scanVaultDiskBlobInventory(resolvedProfileId);
  vaultDiskInventoryProfileId = resolvedProfileId;
  emitLocalMediaIndexChanged();
  return Object.keys(vaultDiskInventoryCache).length;
};

const inferContentTypeFromVaultFileName = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".obscurvault")) {
    return "application/octet-stream";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (lower.endsWith(".webm")) {
    return "video/webm";
  }
  if (lower.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (lower.endsWith(".wav")) {
    return "audio/wav";
  }
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  return "application/octet-stream";
};

/** Re-index encrypted vault blobs on disk that belong to the active profile but lost SQLite rows. */
export const reconcileUnindexedVaultBlobFilesForActiveProfile = async (
  profileId?: string,
): Promise<number> => {
  if (!isTauriRuntime() || !isVaultWriteEncryptionReady(profileId)) {
    return 0;
  }
  const resolvedProfileId = resolveVaultProfileId(profileId).trim();
  if (!resolvedProfileId) {
    return 0;
  }

  const index = getLocalMediaIndexSnapshot();
  const indexedRelativePaths = new Set(
    Object.values(index)
      .map((entry) => entry?.relativePath?.trim())
      .filter((value): value is string => Boolean(value))
      .map(normalizeVaultRelativePathKey),
  );

  const cfg = getLocalMediaStorageConfig(resolvedProfileId);
  const scanTargets: Array<Readonly<{ relativeDir: string; appDataRelative: boolean }>> = [
    { relativeDir: sanitizeSubdir(cfg.subdir || LEGACY_VAULT_MEDIA_DIR), appDataRelative: true },
  ];
  const storage = await resolveVaultStorage();
  if (storage.profileVaultRelativeDir) {
    scanTargets.push({ relativeDir: storage.profileVaultRelativeDir, appDataRelative: false });
    for (const categoryDir of listProfileVaultCategoryRelativeDirs(resolvedProfileId)) {
      scanTargets.push({ relativeDir: categoryDir, appDataRelative: false });
    }
  }

  let added = 0;
  for (const target of scanTargets) {
    const directoryRef = target.appDataRelative
      ? { path: target.relativeDir, appDataRelative: true as const }
      : await resolveEntryStorageRef(target.relativeDir);
    const fileNames = await nativeLocalMediaAdapter.readDirectoryFileNames(
      directoryRef.appDataRelative
        ? { path: directoryRef.path, appDataRelative: true }
        : { path: directoryRef.path },
    );
    for (const fileName of fileNames) {
      if (!isEncryptedVaultStorageFileName(fileName)) {
        continue;
      }
      const relativePath = `${target.relativeDir}/${fileName}`;
      if (
        !target.appDataRelative
        && !relativePathBelongsToProfileVault(relativePath, resolvedProfileId)
      ) {
        continue;
      }
      if (indexedRelativePaths.has(normalizeVaultRelativePathKey(relativePath))) {
        continue;
      }
      try {
        const fileRef = await resolveEntryStorageRef(relativePath);
        const fileBytes = await nativeLocalMediaAdapter.readBytes(
          fileRef.appDataRelative
            ? { path: fileRef.path, appDataRelative: true }
            : { path: fileRef.path },
        );
        if (!fileBytes || fileBytes.byteLength === 0) {
          continue;
        }
        const plaintext = await decryptVaultFileBytesIfNeeded({
          fileBytes,
          profileId: resolvedProfileId,
        });
        const contentHash = await sha256BytesHex(plaintext);
        const vaultUrl = buildLocalVaultOnlyUrl(contentHash);
        if (index[vaultUrl]?.relativePath?.trim()) {
          indexedRelativePaths.add(normalizeVaultRelativePathKey(index[vaultUrl]!.relativePath));
          continue;
        }
        const entry: LocalMediaIndexEntry = {
          remoteUrl: vaultUrl,
          relativePath,
          savedAtUnixMs: Date.now(),
          fileName,
          contentType: inferContentTypeFromVaultFileName(fileName),
          size: plaintext.byteLength,
        };
        await upsertVaultMediaIndexEntryToSqlite(vaultUrl, entry, resolvedProfileId);
        index[vaultUrl] = entry;
        indexedRelativePaths.add(normalizeVaultRelativePathKey(relativePath));
        added += 1;
      } catch {
        // Blob is likely encrypted for another local profile/account — skip silently.
      }
    }
  }

  if (added > 0) {
    vaultIndexCache = { ...index };
    vaultIndexCacheHydrated = true;
    vaultIndexCacheProfileId = resolvedProfileId;
    emitLocalMediaIndexChanged();
    logRuntimeEvent(
      "vault_media_index.reconciled_disk_orphans",
      "expected",
      [`[VaultMediaIndex] Re-indexed ${added} on-disk vault blob(s) for profile ${resolvedProfileId}.`],
    );
  }
  return added;
};

/**
 * Hydrates vault indexes before UI reads.
 * Disk inventory is authoritative and must complete promptly — SQLite / encryption restore
 * run as follow-up so Vault never stays stuck on loading skeletons.
 */
export const ensureVaultMediaIndexReadyForActiveProfile = async (): Promise<void> => {
  const profileId = resolveVaultProfileId().trim();
  if (!profileId || !isTauriRuntime()) {
    return;
  }

  // P1: never carry blob URLs or SQLite cache across profile switches.
  if (
    (vaultDiskInventoryProfileId && vaultDiskInventoryProfileId !== profileId)
    || (vaultIndexCacheProfileId && vaultIndexCacheProfileId !== profileId)
  ) {
    revokeAllVaultMediaBlobUrls();
    vaultIndexCache = {};
    vaultIndexCacheHydrated = false;
    vaultIndexCacheProfileId = null;
  }

  if (vaultDiskInventoryProfileId !== profileId) {
    vaultDiskInventoryCache = {};
    vaultDiskInventoryProfileId = null;
  }

  try {
    await hydrateVaultDiskInventoryForActiveProfile(profileId);
  } catch (error) {
    console.warn("[VaultMediaIndex] Disk inventory hydrate failed:", error);
  }

  void (async (): Promise<void> => {
    try {
      const { restoreNativeVaultEncryptionSessionIfNeeded } = await import(
        "@/app/features/storage/services/native-storage-at-rest-service"
      );
      await restoreNativeVaultEncryptionSessionIfNeeded({ profileId });

      if (!usesSqliteVaultMediaIndex()) {
        return;
      }

      if (vaultIndexCacheProfileId !== profileId) {
        vaultIndexCache = {};
        vaultIndexCacheHydrated = false;
        vaultIndexCacheProfileId = null;
      }

      if (!vaultIndexCacheHydrated || vaultIndexCacheProfileId !== profileId) {
        const { runVaultMediaIndexSqliteImportOnUnlock } = await import("./vault-media-index-sqlite-migration");
        await runVaultMediaIndexSqliteImportOnUnlock();
      }

      if (isVaultWriteEncryptionReady(profileId)) {
        await reconcileUnindexedVaultBlobFilesForActiveProfile(profileId);
        await hydrateVaultDiskInventoryForActiveProfile(profileId);
      }
    } catch (error) {
      console.warn("[VaultMediaIndex] Background index maintenance failed:", error);
    }
  })();
};

const sanitizeSubdir = (raw: string): string => {
    const clean = raw.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    return clean.length > 0 ? clean : DEFAULT_SUBDIR;
};

const sanitizeFileName = (raw: string): string => {
    const file = raw.trim();
    const cleaned = file.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    return cleaned.length > 0 ? cleaned : "file";
};

const LEGACY_HASHED_CACHE_FILE_NAME_PATTERN = /^\d{10,}-[a-f0-9]{12,}-(.+)$/i;
const ENCRYPTED_VAULT_BLOB_FILE_NAME_PATTERN = /^[a-f0-9]{24}\.obscurvault$/i;

export const isEncryptedVaultStorageFileName = (value: string): boolean =>
    ENCRYPTED_VAULT_BLOB_FILE_NAME_PATTERN.test(value.trim());

export const resolveVaultDisplayFileName = (params: Readonly<{
    attachmentFileName?: string;
    indexFileName?: string;
    relativePath?: string;
}>): string => {
    const candidates = [
        params.attachmentFileName,
        params.indexFileName,
        params.relativePath?.split(/[\\/]/).pop(),
    ];
    for (const raw of candidates) {
        if (typeof raw !== "string") {
            continue;
        }
        const trimmed = raw.trim();
        if (!trimmed || isEncryptedVaultStorageFileName(trimmed)) {
            continue;
        }
        const normalized = normalizeLocalMediaDisplayFileName(trimmed);
        if (!normalized || isEncryptedVaultStorageFileName(normalized)) {
            continue;
        }
        return normalized;
    }
    return "file";
};

export const normalizeLocalMediaDisplayFileName = (value: string): string => {
    const sanitized = sanitizeFileName(value);
    const legacyMatch = LEGACY_HASHED_CACHE_FILE_NAME_PATTERN.exec(sanitized);
    const normalized = legacyMatch?.[1]?.trim() ?? sanitized;
    return normalized.length > 0 ? normalized : "file";
};

const inferExtension = (attachment: Attachment): string => {
    const fromName = attachment.fileName.split(".").pop()?.trim().toLowerCase();
    if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
    const contentType = attachment.contentType.toLowerCase();
    if (contentType.includes("jpeg")) return "jpg";
    if (contentType.includes("png")) return "png";
    if (contentType.includes("webp")) return "webp";
    if (contentType.includes("gif")) return "gif";
    if (contentType.includes("mp4")) return "mp4";
    if (contentType.includes("webm")) return "webm";
    if (contentType.includes("mpeg")) return "mp3";
    if (contentType.includes("wav")) return "wav";
    return "bin";
};

const withExtension = (fileName: string, ext: string): string => {
    if (/\.[a-z0-9]{1,8}$/i.test(fileName)) {
        return fileName;
    }
    return `${fileName}.${ext}`;
};

const buildPreferredLocalFileName = (attachment: Attachment): string => {
    const ext = inferExtension(attachment);
    const normalized = normalizeLocalMediaDisplayFileName(attachment.fileName || "file");
    return withExtension(normalized, ext);
};

const resolveUniqueLocalFileTarget = async (
    cfg: LocalMediaStorageConfig,
    preferredFileName: string,
    remoteUrl?: string,
    attachmentKind?: string,
): Promise<Readonly<{ relativePath: string; fileName: string; encrypted: boolean }>> => {
    const profileId = resolveVaultProfileId();
    if (!isVaultWriteEncryptionReady(profileId)) {
        throw new VaultWriteEncryptionRequiredError();
    }
    const normalizedRemoteUrl = remoteUrl?.trim();
    if (!normalizedRemoteUrl) {
        throw new Error("Vault write requires a stable media URL for encrypted storage.");
    }
    const opaqueFileName = await buildOpaqueVaultFileName(normalizedRemoteUrl, profileId);
    const category = mapAttachmentKindToVaultCategory(attachmentKind);
    const storage = await resolveVaultStorage();
    const relativePath = storage.profileVaultRelativeDir
        ? buildProfileVaultCategoryRelativePath(profileId, category, opaqueFileName)
        : storage.absoluteStorageDir
            ? await nativeLocalMediaAdapter.joinPaths(
                await nativeLocalMediaAdapter.joinPaths(storage.absoluteStorageDir, category),
                opaqueFileName,
            )
            : `${cfg.subdir}/${category}/${opaqueFileName}`;
    return { relativePath, fileName: opaqueFileName, encrypted: true };
};

const loadIndex = (): LocalMediaIndex => {
    if (!isBrowser()) return {};
    const diskIndex = readDiskInventoryForActiveProfile();
    if (usesSqliteVaultMediaIndex()) {
        const profileId = resolveVaultProfileId().trim();
        if (!vaultIndexCacheHydrated || vaultIndexCacheProfileId !== profileId) {
            return { ...diskIndex };
        }
        return mergeDiskAndSqliteVaultIndex(diskIndex, vaultIndexCache);
    }
    try {
        const raw = localStorage.getItem(scopedIndexKey());
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return {};
        return parsed as LocalMediaIndex;
    } catch {
        return {};
    }
};

export const getLocalMediaIndexSnapshot = (): LocalMediaIndex => loadIndex();

/** Poll until an index row with storage path exists (row-proof gate for chat→vault). */
export const awaitVaultIndexRowForKey = async (params: Readonly<{
    indexKey: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
}>): Promise<boolean> => {
    const indexKey = params.indexKey.trim();
    if (!indexKey) {
        return false;
    }
    const timeoutMs = params.timeoutMs ?? 5_000;
    const pollIntervalMs = params.pollIntervalMs ?? 50;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const entry = getLocalMediaIndexSnapshot()[indexKey];
        if (entry?.relativePath?.trim()) {
            return true;
        }
        await new Promise<void>((resolve) => {
            setTimeout(resolve, pollIntervalMs);
        });
    }
    return false;
};

const saveIndex = (index: LocalMediaIndex): void => {
    if (!isBrowser()) return;
    if (usesSqliteVaultMediaIndex()) {
        const profileId = resolveVaultProfileId().trim();
        if (!profileId) {
            return;
        }
        const previous = vaultIndexCache;
        const removedUrls = Object.keys(previous).filter((url) => !(url in index));
        vaultIndexCache = { ...index };
        vaultIndexCacheHydrated = true;
        vaultIndexCacheProfileId = profileId;
        void persistVaultMediaIndexSnapshotToSqlite(index, profileId);
        if (removedUrls.length > 0) {
            void Promise.all(
                removedUrls.map((remoteUrl) =>
                    deleteVaultMediaIndexEntryFromSqlite(remoteUrl, profileId).catch(() => undefined),
                ),
            );
        }
        return;
    }
    localStorage.setItem(scopedIndexKey(), JSON.stringify(index));
};

export const repairLocalMediaIndex = (): Readonly<{ repaired: number; removed: number }> => {
    if (!isBrowser()) return { repaired: 0, removed: 0 };
    const index = loadIndex();
    let repaired = 0;
    let removed = 0;
    const next: LocalMediaIndex = {};

    Object.entries(index).forEach(([remoteUrl, entry]) => {
        const hasRequiredShape = !!entry
            && typeof entry.remoteUrl === "string"
            && typeof entry.relativePath === "string"
            && Number.isFinite(entry.savedAtUnixMs)
            && Number.isFinite(entry.size);
        if (!hasRequiredShape) {
            removed += 1;
            return;
        }
        const normalizedRemoteUrl = entry.remoteUrl.trim().length > 0 ? entry.remoteUrl.trim() : remoteUrl;
        const normalizedRelativePath = entry.relativePath.trim();
        const normalizedFileName = typeof entry.fileName === "string" && entry.fileName.trim().length > 0
            ? resolveVaultDisplayFileName({
                indexFileName: entry.fileName,
                relativePath: normalizedRelativePath,
            })
            : resolveVaultDisplayFileName({
                relativePath: normalizedRelativePath,
            });
        if (normalizedRemoteUrl !== entry.remoteUrl || normalizedRelativePath !== entry.relativePath) {
            repaired += 1;
        }
        if (normalizedFileName !== entry.fileName) {
            repaired += 1;
        }
        if (normalizedRelativePath.length === 0) {
            removed += 1;
            return;
        }
        next[normalizedRemoteUrl] = {
            ...entry,
            remoteUrl: normalizedRemoteUrl,
            relativePath: normalizedRelativePath,
            fileName: normalizedFileName,
        };
    });

    saveIndex(next);
    return { repaired, removed };
};

export const pruneLocalMediaIndexRetention = (
    nowMs: number = Date.now(),
    profileId?: string,
): Readonly<{ removedByAge: number; removedByCap: number; remaining: number }> => {
    if (!isBrowser()) {
        return { removedByAge: 0, removedByCap: 0, remaining: 0 };
    }
    const resolvedProfileId = resolveVaultProfileId(profileId).trim();
    let index: LocalMediaIndex = {};
    if (usesSqliteVaultMediaIndex()) {
        if (resolvedProfileId && vaultIndexCacheProfileId === resolvedProfileId) {
            index = { ...vaultIndexCache };
        }
    } else {
        try {
            const raw = localStorage.getItem(scopedIndexKey(profileId));
            if (raw) {
                const parsed = JSON.parse(raw) as unknown;
                if (parsed && typeof parsed === "object") {
                    index = parsed as LocalMediaIndex;
                }
            }
        } catch {
            index = {};
        }
    }
    const entries = Object.entries(index).map(([remoteUrl, entry]) => ({
        remoteUrl: (typeof entry?.remoteUrl === "string" && entry.remoteUrl.trim().length > 0)
            ? entry.remoteUrl.trim()
            : remoteUrl,
        savedAtUnixMs: entry?.savedAtUnixMs ?? Number.NaN,
    }));
    const plan = pruneLocalMediaIndexRetentionEntries(entries, nowMs);
    const keepSet = new Set(plan.keptRemoteUrls);
    const next: LocalMediaIndex = {};
    Object.entries(index).forEach(([remoteUrl, entry]) => {
        const normalizedUrl = (typeof entry?.remoteUrl === "string" && entry.remoteUrl.trim().length > 0)
            ? entry.remoteUrl.trim()
            : remoteUrl;
        if (keepSet.has(normalizedUrl) && entry) {
            next[normalizedUrl] = entry;
        }
    });
    if (usesSqliteVaultMediaIndex()) {
        if (!resolvedProfileId || vaultIndexCacheProfileId !== resolvedProfileId) {
            return {
                removedByAge: plan.removedByAge,
                removedByCap: plan.removedByCap,
                remaining: plan.keptRemoteUrls.length,
            };
        }
        saveIndex(next);
    } else {
        localStorage.setItem(scopedIndexKey(profileId), JSON.stringify(next));
    }
    return {
        removedByAge: plan.removedByAge,
        removedByCap: plan.removedByCap,
        remaining: plan.keptRemoteUrls.length,
    };
};

export const getLocalMediaIndexEntryByRemoteUrl = (remoteUrl: string): LocalMediaIndexEntry | null => {
    const index = getLocalMediaIndexSnapshot();
    return index[remoteUrl] ?? null;
};

/** Links cached attachment URLs to the durable message event_id after SQLite persist. */
export const linkLocalMediaIndexToMessageEvent = (params: Readonly<{
    messageEventId: string;
    attachmentUrls: ReadonlyArray<string>;
}>): void => {
    if (!isTauriRuntime()) {
        return;
    }
    const messageEventId = params.messageEventId.trim();
    if (!messageEventId) {
        return;
    }
    const index = loadIndex();
    let changed = false;
    params.attachmentUrls.forEach((rawUrl) => {
        const remoteUrl = rawUrl.trim();
        if (!remoteUrl) {
            return;
        }
        const existing = index[remoteUrl];
        if (existing?.messageEventId === messageEventId) {
            return;
        }
        index[remoteUrl] = existing
            ? { ...existing, messageEventId }
            : {
                remoteUrl,
                relativePath: "",
                savedAtUnixMs: Date.now(),
                fileName: "",
                contentType: "",
                size: 0,
                messageEventId,
            };
        changed = true;
    });
    if (changed) {
        saveIndex(index);
    }
};

export const getLocalMediaStorageConfig = (profileId?: string): LocalMediaStorageConfig => {
    if (!isBrowser()) return DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG;
    try {
        const raw = localStorage.getItem(scopedConfigKey(profileId));
        if (!raw) return DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG;
        const parsed = JSON.parse(raw) as Partial<LocalMediaStorageConfig>;
        return {
            enabled: parsed.enabled ?? DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG.enabled,
            subdir: sanitizeSubdir(parsed.subdir ?? DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG.subdir),
            customRootPath: typeof parsed.customRootPath === "string" ? parsed.customRootPath.trim() : DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG.customRootPath,
            downloadRootPath: typeof parsed.downloadRootPath === "string" ? parsed.downloadRootPath.trim() : DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG.downloadRootPath,
            cacheSentFiles: parsed.cacheSentFiles ?? DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG.cacheSentFiles,
            cacheReceivedFiles: parsed.cacheReceivedFiles ?? DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG.cacheReceivedFiles,
        };
    } catch {
        return DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG;
    }
};

export const saveLocalMediaStorageConfig = (
    config: LocalMediaStorageConfig,
    profileId?: string,
): LocalMediaStorageConfig => {
    const normalized: LocalMediaStorageConfig = {
        enabled: config.enabled,
        subdir: sanitizeSubdir(config.subdir),
        customRootPath: isTauriRuntime() ? "" : config.customRootPath.trim(),
        downloadRootPath: config.downloadRootPath.trim(),
        cacheSentFiles: config.cacheSentFiles,
        cacheReceivedFiles: config.cacheReceivedFiles,
    };
    if (isBrowser()) {
        localStorage.setItem(scopedConfigKey(profileId), JSON.stringify(normalized));
    }
    return normalized;
};

const ensureStorageDir = async (subdir: string): Promise<void> => {
    await nativeLocalMediaAdapter.ensureDirectory({ path: subdir, appDataRelative: true });
};

const buildAbsolutePath = async (relativePath: string): Promise<string> => {
    const root = await nativeLocalMediaAdapter.getAppDataDirPath();
    if (!root) {
        throw new Error("Native local media path is unavailable");
    }
    return nativeLocalMediaAdapter.joinPaths(root, relativePath);
};

const resolveStorageAbsolutePath = async (): Promise<string> => {
    const storage = await resolveVaultStorage();
    if (storage.absoluteStorageDir) {
        return storage.absoluteStorageDir;
    }
    const cfg = getLocalMediaStorageConfig();
    return buildAbsolutePath(cfg.subdir);
};

const ensureStorageAbsoluteDir = async (): Promise<void> => {
    const storage = await resolveVaultStorage();
    if (storage.absoluteStorageDir) {
        await nativeLocalMediaAdapter.ensureDirectory({ path: storage.absoluteStorageDir });
        if (storage.profileVaultRelativeDir && storage.unifiedDataRootPath) {
            const profileId = resolveVaultProfileId().trim() || "default";
            for (const categoryDir of listProfileVaultCategoryRelativeDirs(profileId)) {
                const absoluteCategoryDir = await nativeLocalMediaAdapter.joinPaths(
                    storage.unifiedDataRootPath,
                    categoryDir,
                );
                await nativeLocalMediaAdapter.ensureDirectory({ path: absoluteCategoryDir });
            }
        }
        return;
    }
    const cfg = getLocalMediaStorageConfig();
    await ensureStorageDir(cfg.subdir);
};

const ensureVaultEntryParentDir = async (entryPath: string): Promise<void> => {
    if (isAbsoluteStoragePath(entryPath)) {
        const parent = await nativeLocalMediaAdapter.parentPath(entryPath);
        if (parent) {
            await nativeLocalMediaAdapter.ensureDirectory({ path: parent });
        }
        return;
    }
    const absolutePath = await resolveEntryAbsolutePath(entryPath);
    const parent = await nativeLocalMediaAdapter.parentPath(absolutePath);
    if (parent) {
        await nativeLocalMediaAdapter.ensureDirectory({ path: parent });
    }
};

export const ensureLocalMediaStoragePathReady = async (): Promise<boolean> => {
    if (!isTauriRuntime()) return false;
    try {
        await ensureStorageAbsoluteDir();
        return true;
    } catch (error) {
        logRuntimeEvent(
            "local_media_store.ensure_storage_path_failed",
            "degraded",
            ["[LocalMediaStore] Failed to prepare local storage path.", { error: error instanceof Error ? error.message : String(error) }],
            { windowMs: 30_000, maxPerWindow: 1, summaryEverySuppressed: 5 }
        );
        return false;
    }
};

export const getLocalMediaStorageAbsolutePath = async (): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    return resolveStorageAbsolutePath();
};

export const openLocalMediaStoragePath = async (): Promise<boolean> => {
    if (!isTauriRuntime()) return false;
    const isReady = await ensureLocalMediaStoragePathReady();
    if (!isReady) return false;
    const path = await resolveStorageAbsolutePath();
    if (!path) return false;
    try {
        return await nativeLocalMediaAdapter.openPath(path);
    } catch (error) {
        logRuntimeEvent(
            "local_media_store.open_storage_path_failed",
            "degraded",
            ["[LocalMediaStore] Failed to open local storage path.", { path, error: error instanceof Error ? error.message : String(error) }],
            { windowMs: 30_000, maxPerWindow: 1, summaryEverySuppressed: 5 }
        );
        return false;
    }
};

export const revealLocalMediaItemPath = async (remoteUrl: string): Promise<boolean> => {
    if (!isTauriRuntime()) return false;
    const normalizedRemoteUrl = remoteUrl.trim();
    if (!normalizedRemoteUrl) return false;
    const index = loadIndex();
    const entry = index[normalizedRemoteUrl];
    if (!entry?.relativePath) return false;
    try {
        const entryRef = await resolveEntryStorageRef(entry.relativePath);
        const hasFile = await nativeLocalMediaAdapter.fileExists(entryRef);
        if (!hasFile) {
            delete index[normalizedRemoteUrl];
            saveIndex(index);
            return false;
        }
        const absolutePath = await resolveEntryAbsolutePath(entry.relativePath);
        const revealTarget = isEncryptedVaultRelativePath(entry.relativePath)
            ? (await nativeLocalMediaAdapter.parentPath(absolutePath)) ?? absolutePath
            : absolutePath;
        const revealResult = await invokeNativeCommand<void>("desktop_reveal_path_in_file_manager", {
            path: revealTarget,
        });
        if (revealResult.ok) {
            return true;
        }
        if (!isEncryptedVaultRelativePath(entry.relativePath)) {
            return nativeLocalMediaAdapter.openPath(absolutePath);
        }
        return false;
    } catch {
        return false;
    }
};

export const resolveLocalMediaUrl = async (remoteUrl: string): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    const index = loadIndex();
    const entry = index[remoteUrl];
    if (!entry) return null;
    const activeProfileId = resolveVaultProfileId().trim() || "default";
    if (
        isProfileScopedVaultRelativePath(entry.relativePath)
        && !relativePathBelongsToProfileVault(entry.relativePath, activeProfileId)
    ) {
        return null;
    }
    try {
        const entryRef = await resolveEntryStorageRef(entry.relativePath);
        const hasFile = await nativeLocalMediaAdapter.fileExists(entryRef);
        if (!hasFile) {
            delete index[remoteUrl];
            saveIndex(index);
            return null;
        }
        const absolutePath = await resolveEntryAbsolutePath(entry.relativePath);
        if (isEncryptedVaultRelativePath(entry.relativePath)) {
            const fileBytes = await nativeLocalMediaAdapter.readBytes(await resolveEntryStorageRef(entry.relativePath));
            if (!fileBytes) {
                return null;
            }
            const decrypted = await decryptVaultFileBytesIfNeeded({ fileBytes });
            const blob = new Blob([decrypted.slice()], { type: entry.contentType || "application/octet-stream" });
            return registerVaultMediaBlobUrl(remoteUrl, URL.createObjectURL(blob));
        }
        return nativeLocalMediaAdapter.convertAbsolutePathToFileSrc(absolutePath);
    } catch {
        return null;
    }
};

export const listLocalMediaCacheItems = async (): Promise<ReadonlyArray<LocalMediaCacheItem>> => {
    if (!isTauriRuntime()) return [];
    const index = loadIndex();
    const urls = Object.keys(index);
    const items = await Promise.all(urls.map(async (remoteUrl): Promise<LocalMediaCacheItem | null> => {
        const entry = index[remoteUrl];
        if (!entry) return null;
        const localUrl = await resolveLocalMediaUrl(remoteUrl);
        if (!localUrl) return null;
        return {
            remoteUrl,
            localUrl,
            relativePath: entry.relativePath,
            savedAtUnixMs: entry.savedAtUnixMs,
            fileName: entry.fileName,
            contentType: entry.contentType,
            size: entry.size,
        };
    }));
    return items.filter((item): item is LocalMediaCacheItem => item !== null);
};

const fetchBytesViaNative = async (url: string, timeoutMs: number): Promise<Uint8Array | null> => {
    if (!isTauriRuntime()) {
        return null;
    }
    const normalizedUrl = normalizeAttachmentUrl(url);
    if (!isSecureRemoteAttachmentFetchUrl(normalizedUrl)) {
        return null;
    }
    const result = await invokeNativeCommand<number[]>(
        "fetch_remote_bytes",
        { url: normalizedUrl },
        { timeoutMs },
    );
    if (!result.ok || !Array.isArray(result.value) || result.value.length === 0) {
        return null;
    }
    return new Uint8Array(result.value);
};

const fetchBytesViaTauriHttp = async (url: string, timeoutMs: number): Promise<Uint8Array | null> => {
    if (!isTauriRuntime()) {
        return null;
    }
    const normalizedUrl = normalizeAttachmentUrl(url);
    if (!isSecureRemoteAttachmentFetchUrl(normalizedUrl)) {
        return null;
    }
    try {
        const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
        const response = await tauriFetch(normalizedUrl, {
            method: "GET",
            connectTimeout: timeoutMs,
        } as Parameters<typeof tauriFetch>[1]);
        if (!response.ok) {
            return null;
        }
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        return bytes.byteLength > 0 ? bytes : null;
    } catch {
        return null;
    }
};

const isPrivateIpv4Host = (host: string): boolean => {
    const segments = host.split(".").map((part) => Number.parseInt(part, 10));
    if (segments.length !== 4 || segments.some((segment) => Number.isNaN(segment) || segment < 0 || segment > 255)) {
        return false;
    }
    const [a, b] = segments;
    if (a === 10 || a === 127) {
        return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
        return true;
    }
    if (a === 192 && b === 168) {
        return true;
    }
    if (a === 169 && b === 254) {
        return true;
    }
    return false;
};

const isBlockedAttachmentFetchHost = (host: string): boolean => {
    const lowerHost = host.trim().toLowerCase();
    if (!lowerHost) {
        return true;
    }
    if (
        lowerHost === "localhost"
        || lowerHost === "::1"
        || lowerHost === "[::1]"
        || lowerHost.endsWith(".local")
        || lowerHost.endsWith(".internal")
    ) {
        return true;
    }
    if (isPrivateIpv4Host(lowerHost)) {
        return true;
    }
    return false;
};

const isTrustedLocalAttachmentUrl = (url: URL): boolean => {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        const current = new URL(window.location.href);
        const sameOrigin = current.origin.toLowerCase() === url.origin.toLowerCase();
        if (!sameOrigin) {
            return false;
        }
        // Same-origin attachment proxy URLs are app-controlled and safe to read.
        return true;
    } catch {
        return false;
    }
};

export const classifyAttachmentFetchUrlForVaultSave = (
    url: string,
): "ok" | "blocked_host" | "unsupported" => {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return "unsupported";
        }
        if (isBlockedAttachmentFetchHost(parsed.hostname) && !isTrustedLocalAttachmentUrl(parsed)) {
            return "blocked_host";
        }
        return "ok";
    } catch {
        return "unsupported";
    }
};

const isSecureRemoteAttachmentFetchUrl = (url: string): boolean =>
    classifyAttachmentFetchUrlForVaultSave(url) === "ok";

const readLocalAttachmentBytesForDownload = async (remoteUrl: string): Promise<Uint8Array | null> => {
    const index = loadIndex();
    const entry = index[remoteUrl];
    if (!entry?.relativePath) {
        return null;
    }
    const activeProfileId = resolveVaultProfileId().trim() || "default";
    if (
        isProfileScopedVaultRelativePath(entry.relativePath)
        && !relativePathBelongsToProfileVault(entry.relativePath, activeProfileId)
    ) {
        return null;
    }
    const fileBytes = await nativeLocalMediaAdapter.readBytes(await resolveEntryStorageRef(entry.relativePath));
    if (!fileBytes || fileBytes.byteLength === 0) {
        return null;
    }
    return decryptVaultFileBytesIfNeeded({ fileBytes });
};

const fetchBytes = async (url: string, fileType?: string, attempt = 1): Promise<Uint8Array> => {
    const normalizedUrl = normalizeAttachmentUrl(url);
    if (!normalizedUrl) {
        throw new Error("Attachment URL is empty");
    }
    if (!isSecureRemoteAttachmentFetchUrl(normalizedUrl)) {
        throw new Error("Attachment URL is not a secure remote URL");
    }

    const isVideo = fileType?.startsWith("video/") || normalizedUrl.match(/\.(mp4|webm|mov|avi|mkv)($|\?)/i);
    const baseTimeoutMs = isVideo ? 300_000 : 120_000;
    const timeoutMs = baseTimeoutMs + (attempt - 1) * 30_000;

    if (attempt === 1) {
        try {
            const tauriHttpBytes = await fetchBytesViaTauriHttp(normalizedUrl, timeoutMs);
            if (tauriHttpBytes && tauriHttpBytes.byteLength > 0) {
                return tauriHttpBytes;
            }
            const nativeBytes = await fetchBytesViaNative(normalizedUrl, timeoutMs);
            if (nativeBytes && nativeBytes.byteLength > 0) {
                return nativeBytes;
            }
        } catch (error) {
            console.warn("[LocalMediaStore] Native remote fetch failed, falling back to webview fetch:", error);
        }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(normalizedUrl, { method: "GET", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
    } catch (error) {
        // Retry up to 3 times with exponential backoff
        if (attempt < 3) {
            const delayMs = Math.min(1000 * Math.pow(2, attempt), 10000);
            console.log(`[LocalMediaStore] fetchBytes retry ${attempt + 1}/3 for ${normalizedUrl} after ${delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return fetchBytes(normalizedUrl, fileType, attempt + 1);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

export const fetchRemoteAttachmentBytesForVaultSave = async (
    url: string,
    contentType?: string,
): Promise<Uint8Array | null> => {
    try {
        return await fetchBytes(url, contentType);
    } catch {
        return null;
    }
};

export const cacheAttachmentLocally = async (
    attachment: Attachment,
    mode: "sent" | "received",
    localBytes?: Uint8Array,
    options?: Readonly<{ force?: boolean; messageEventId?: string; explicitChatSave?: boolean }>,
): Promise<string | null> => {
    if (options?.explicitChatSave) {
        throw new Error(
            "Legacy explicitChatSave vault write retired (LES R5). Use saveChatAttachmentToLes.",
        );
    }
    if (!isTauriRuntime()) return null;
    const cfg = getLocalMediaStorageConfig();
    if (!shouldAllowLocalMediaCacheWrite(cfg, options)) return null;
    if (!options?.force) {
        if (mode === "sent" && !cfg.cacheSentFiles) return null;
        if (mode === "received" && !cfg.cacheReceivedFiles) return null;
    }
    if (localCacheWriteBlocked) {
        if (!localCacheBlockedWarningEmitted) {
            localCacheBlockedWarningEmitted = true;
            logRuntimeEvent(
                "local_media_store.cache_disabled_after_path_forbidden",
                "degraded",
                ["[LocalMediaStore] Local cache writes disabled for this session due to storage permission/path restrictions."]
            );
        }
        return null;
    }

    const existing = await resolveLocalMediaUrl(attachment.url);
    if (existing) {
        // Explicit user save should still annotate index metadata even when bytes already exist.
        if (options?.messageEventId || options?.explicitChatSave) {
            const index = loadIndex();
            const currentEntry = index[attachment.url];
            if (currentEntry) {
                const nextMessageEventId = options?.messageEventId?.trim();
                const nextEntry: LocalMediaIndexEntry = {
                    ...currentEntry,
                    ...(nextMessageEventId ? { messageEventId: nextMessageEventId } : {}),
                    ...(options?.explicitChatSave ? { explicitChatSave: true } : {}),
                };
                index[attachment.url] = nextEntry;
                saveIndex(index);
                emitLocalMediaIndexChanged();
            }
        }
        return existing;
    }

    if (!isVaultWriteEncryptionReady()) {
        if (options?.force) {
            throw new VaultWriteEncryptionRequiredError();
        }
        return null;
    }

    try {
        await ensureStorageAbsoluteDir();
        const bytes = localBytes ?? await fetchBytes(attachment.url, attachment.contentType);

        // Ensure we don't save empty corrupted files
        if (bytes.byteLength === 0) {
            throw new Error("Cannot cache empty file (0 bytes)");
        }

        const preferredFileName = buildPreferredLocalFileName(attachment);
        const target = await resolveUniqueLocalFileTarget(
            cfg,
            preferredFileName,
            attachment.url,
            attachment.kind,
        );
        const relativePath = target.relativePath;
        const displayFileName = resolveVaultDisplayFileName({
            attachmentFileName: attachment.fileName,
            indexFileName: preferredFileName,
        });
        const encryptedPayload = await encryptVaultBytesForWrite({ plaintext: bytes });
        const payload = encryptedPayload.bytes;

        await writeVaultBytesToEntryPath(relativePath, payload);

        // Reload index to avoid race conditions when uploading multiple files concurrently
        const currentIndex = loadIndex();
        currentIndex[attachment.url] = {
            remoteUrl: attachment.url,
            relativePath,
            savedAtUnixMs: Date.now(),
            fileName: displayFileName,
            contentType: attachment.contentType,
            size: bytes.byteLength,
            ...(options?.messageEventId ? { messageEventId: options.messageEventId } : {}),
            ...(options?.explicitChatSave ? { explicitChatSave: true } : {}),
        };
        saveIndex(currentIndex);
        emitLocalMediaIndexChanged();
        void hydrateVaultDiskInventoryForActiveProfile();
        return resolveLocalMediaUrl(attachment.url);
    } catch (error) {
        if (error instanceof VaultWriteEncryptionRequiredError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("forbidden path")) {
            localCacheWriteBlocked = true;
            if (!localCacheBlockedWarningEmitted) {
                localCacheBlockedWarningEmitted = true;
                logRuntimeEvent(
                    "local_media_store.cache_failed.forbidden_path",
                    "degraded",
                    [
                        "[LocalMediaStore] Cache path is not permitted. Falling back to remote media URLs for this session.",
                        attachment.url,
                    ],
                    { maxPerWindow: 1, windowMs: 60_000 }
                );
            }
            return null;
        }
        logRuntimeEvent(
            "local_media_store.cache_failed.general",
            "degraded",
            ["[LocalMediaStore] Failed to cache attachment:", attachment.url, error],
            { windowMs: 15_000, maxPerWindow: 2, summaryEverySuppressed: 25 }
        );
        return null;
    }
};

/** Explicit user action — bypasses sent/received auto-cache settings. */
export const persistAttachmentToLocalVault = async (
    _attachment: Attachment,
    _localBytes?: Uint8Array,
): Promise<string | null> => {
    throw new Error(
      "Legacy vault persist retired (LES R5). Use saveChatAttachmentToLes / commitLesObjectWithProof.",
    );
};

export const isVaultEncryptionSessionReady = (): boolean => isVaultWriteEncryptionReady();

export const saveFileToLocalVault = async (_file: File): Promise<SaveFileToLocalVaultResult | null> => {
    throw new Error(
      "Legacy saveFileToLocalVault retired (LES R5). Use uploadFilesToLes / commitLesObjectWithProof.",
    );
};

export const purgeLocalMediaCache = async (): Promise<void> => {
    if (!isTauriRuntime()) return;
    localCacheWriteBlocked = false;
    localCacheBlockedWarningEmitted = false;
    const cfg = getLocalMediaStorageConfig();
    const indexSnapshot = loadIndex();
    let removedByRoot = false;
    try {
        const storage = await resolveVaultStorage();
        if (storage.absoluteStorageDir) {
            await nativeLocalMediaAdapter.removePath({ path: storage.absoluteStorageDir, recursive: true });
        } else {
            await nativeLocalMediaAdapter.removePath({ path: cfg.subdir, appDataRelative: true, recursive: true });
        }
        removedByRoot = true;
    } catch {
        removedByRoot = false;
    }
    if (!removedByRoot) {
        const entries = Object.values(indexSnapshot);
        await Promise.all(entries.map(async (entry) => {
            try {
                await nativeLocalMediaAdapter.removePath(await resolveEntryStorageRef(entry.relativePath));
            } catch {
                // Best-effort per-item deletion fallback.
            }
        }));
    }
    if (isBrowser()) {
        if (usesSqliteVaultMediaIndex()) {
            const profileId = resolveVaultProfileId().trim();
            if (profileId) {
                await deleteAllVaultMediaIndexEntriesFromSqlite(profileId);
            }
            resetVaultMediaIndexCache();
            emitLocalMediaIndexChanged();
        } else {
            localStorage.removeItem(scopedIndexKey());
        }
    }
};

export const deleteLocalMediaCacheItem = async (remoteUrl: string): Promise<boolean> => {
    if (!isTauriRuntime()) return false;
    const index = loadIndex();
    const entry = index[remoteUrl];
    if (!entry) return false;

    try {
        await nativeLocalMediaAdapter.removePath(await resolveEntryStorageRef(entry.relativePath));
    } catch {
        // Ignore file removal failures; still clean stale index below.
    }

    delete index[remoteUrl];
    revokeVaultMediaBlobUrl(remoteUrl);
    saveIndex(index);
    return true;
};

export const downloadAttachmentToUserPath = async (params: Readonly<{
    attachment: Attachment;
    sourceUrl?: string;
}>): Promise<boolean> => {
    const sourceUrl = params.sourceUrl?.trim() || params.attachment.url.trim();
    if (!sourceUrl) return false;

    if (isTauriRuntime()) {
        try {
            const cfg = getLocalMediaStorageConfig();
            const fileName = params.attachment.fileName && params.attachment.fileName.trim().length > 0
                ? params.attachment.fileName.trim()
                : buildPreferredLocalFileName(params.attachment);
            const defaultPath = cfg.downloadRootPath.trim().length > 0
                ? await nativeLocalMediaAdapter.joinPaths(cfg.downloadRootPath.trim(), fileName)
                : fileName;
            const targetPath = await nativeLocalMediaAdapter.pickSavePath({ defaultPath });
            if (!targetPath) return false;
            const bytes = (
                await readLocalAttachmentBytesForDownload(params.attachment.url)
            ) ?? (
                await fetchBytes(sourceUrl, params.attachment.contentType)
            );
            await nativeLocalMediaAdapter.writeBytes({
                path: targetPath,
                bytes,
            });
            return true;
        } catch (error) {
            logRuntimeEvent(
                "local_media_store.download_attachment_failed",
                "degraded",
                ["[LocalMediaStore] Failed to download attachment to user-selected path.", {
                    sourceUrl,
                    fileName: params.attachment.fileName,
                    error: error instanceof Error ? error.message : String(error),
                }],
                { windowMs: 15_000, maxPerWindow: 2, summaryEverySuppressed: 10 }
            );
            return false;
        }
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
        return false;
    }

    const anchor = document.createElement("a");
    anchor.href = sourceUrl;
    anchor.download = params.attachment.fileName || "download";
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
};

/** Explicit plaintext exit for encrypted sandbox policy. */
export const exportDecryptedVaultAttachmentToUserPath = downloadAttachmentToUserPath;

export { revokeAllVaultMediaBlobUrls, revokeVaultMediaBlobUrl } from "./vault-media-blob-lifecycle";

export const pickLocalMediaStorageRootPath = async (): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    try {
        return await nativeLocalMediaAdapter.pickDirectory();
    } catch {
        return null;
    }
};

export type VaultLegacyMigrationEntryResult =
    | "migrated"
    | "already_encrypted"
    | "missing_file"
    | "failed";

export const isLegacyPlaintextVaultIndexEntry = (entry: Readonly<{ relativePath: string }>): boolean =>
    !isEncryptedVaultRelativePath(entry.relativePath);

export const migrateLegacyPlaintextVaultIndexEntry = async (remoteUrl: string): Promise<VaultLegacyMigrationEntryResult> => {
    if (!isTauriRuntime() || !isVaultWriteEncryptionReady()) {
        return "failed";
    }
    const normalizedRemoteUrl = remoteUrl.trim();
    if (!normalizedRemoteUrl) {
        return "failed";
    }

    const index = loadIndex();
    const entry = index[normalizedRemoteUrl];
    if (!entry) {
        return "missing_file";
    }
    if (!isLegacyPlaintextVaultIndexEntry(entry)) {
        return "already_encrypted";
    }

    const legacyRef = await resolveEntryStorageRef(entry.relativePath);
    const legacyExists = await nativeLocalMediaAdapter.fileExists(legacyRef);
    if (!legacyExists) {
        delete index[normalizedRemoteUrl];
        saveIndex(index);
        emitLocalMediaIndexChanged();
        return "missing_file";
    }

    try {
        const fileBytes = await nativeLocalMediaAdapter.readBytes(legacyRef);
        if (!fileBytes || fileBytes.byteLength === 0) {
            return "failed";
        }
        const plaintext = await decryptVaultFileBytesIfNeeded({ fileBytes });
        const encryptedPayload = await encryptVaultBytesForWrite({ plaintext });
        const cfg = getLocalMediaStorageConfig();
        const target = await resolveUniqueLocalFileTarget(
            cfg,
            entry.fileName,
            normalizedRemoteUrl,
            inferAttachmentKindFromMeta(entry.fileName, entry.contentType),
        );
        const targetRef = await resolveEntryStorageRef(target.relativePath);
        const targetExists = await nativeLocalMediaAdapter.fileExists(targetRef);
        if (!targetExists) {
            await writeVaultBytesToEntryPath(target.relativePath, encryptedPayload.bytes);
        }

        index[normalizedRemoteUrl] = {
            ...entry,
            relativePath: target.relativePath,
            size: plaintext.byteLength,
        };
        saveIndex(index);
        emitLocalMediaIndexChanged();

        if (target.relativePath !== entry.relativePath) {
            try {
                await nativeLocalMediaAdapter.removePath(legacyRef);
            } catch {
                // Best-effort cleanup of legacy plaintext file.
            }
        }
        return "migrated";
    } catch (error) {
        logRuntimeEvent(
            "local_media_store.legacy_migration_failed",
            "degraded",
            ["[LocalMediaStore] Failed to migrate legacy plaintext vault entry:", normalizedRemoteUrl, error],
            { windowMs: 15_000, maxPerWindow: 3 },
        );
        return "failed";
    }
};

export type VaultLayoutMigrationEntryResult =
    | "migrated"
    | "already_migrated"
    | "missing_file"
    | "failed";

export { isLegacyVaultLayoutIndexEntry } from "./local-media-vault-path";

export const migrateLegacyVaultLayoutIndexEntry = async (remoteUrl: string): Promise<VaultLayoutMigrationEntryResult> => {
    if (!isTauriRuntime() || !isVaultWriteEncryptionReady()) {
        return "failed";
    }
    const normalizedRemoteUrl = remoteUrl.trim();
    if (!normalizedRemoteUrl) {
        return "failed";
    }

    const index = loadIndex();
    const entry = index[normalizedRemoteUrl];
    if (!entry) {
        return "missing_file";
    }
    if (extractVaultCategoryFromRelativePath(entry.relativePath)) {
        return "already_migrated";
    }
    const needsLayoutMove =
        isLegacyVaultLayoutIndexEntry(entry)
        || isFlatProfileVaultBlobRelativePath(entry.relativePath);
    if (!needsLayoutMove) {
        return "already_migrated";
    }

    const profileId = resolveVaultProfileId().trim() || "default";
    const sourceRef = await resolveEntryStorageRef(entry.relativePath);
    const sourceExists = await nativeLocalMediaAdapter.fileExists(sourceRef);
    if (!sourceExists) {
        delete index[normalizedRemoteUrl];
        saveIndex(index);
        emitLocalMediaIndexChanged();
        return "missing_file";
    }

    const blobFileName = extractVaultBlobFileName(entry.relativePath);
    if (!blobFileName) {
        return "failed";
    }
    const category = mapAttachmentKindToVaultCategory(
        inferAttachmentKindFromMeta(entry.fileName, entry.contentType),
    );
    const targetRelativePath = buildProfileVaultCategoryRelativePath(
        profileId,
        category,
        blobFileName,
    );

    try {
        const sourceAbsolutePath = await resolveEntryAbsolutePath(entry.relativePath);
        const targetAbsolutePath = await resolveEntryAbsolutePath(targetRelativePath);
        if (sourceAbsolutePath === targetAbsolutePath) {
            index[normalizedRemoteUrl] = { ...entry, relativePath: targetRelativePath };
            saveIndex(index);
            emitLocalMediaIndexChanged();
            return "migrated";
        }

        const targetParent = await nativeLocalMediaAdapter.parentPath(targetAbsolutePath);
        if (targetParent) {
            await nativeLocalMediaAdapter.ensureDirectory({ path: targetParent });
        }

        const moved = await nativeLocalMediaAdapter.movePath({
            from: sourceAbsolutePath,
            to: targetAbsolutePath,
        });
        if (!moved) {
            const fileBytes = await nativeLocalMediaAdapter.readBytes(sourceRef);
            if (!fileBytes || fileBytes.byteLength === 0) {
                return "failed";
            }
            await writeVaultBytesToEntryPath(targetRelativePath, fileBytes);
            await nativeLocalMediaAdapter.removePath(sourceRef);
        }

        index[normalizedRemoteUrl] = {
            ...entry,
            relativePath: targetRelativePath,
        };
        saveIndex(index);
        emitLocalMediaIndexChanged();
        return "migrated";
    } catch (error) {
        logRuntimeEvent(
            "local_media_store.layout_migration_failed",
            "degraded",
            ["[LocalMediaStore] Failed to migrate vault layout entry:", normalizedRemoteUrl, error],
            { windowMs: 15_000, maxPerWindow: 3 },
        );
        return "failed";
    }
};
