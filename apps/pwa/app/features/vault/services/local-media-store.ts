"use client";

import type { Attachment, AttachmentKind } from "../../messaging/types";
import { getMediaKindForPolicy } from "../../messaging/lib/media-upload-policy";
import { pruneLocalMediaIndexRetentionEntries } from "@/app/features/runtime/services/self-cleaning-retention-sweep-policy";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getObscurDataRootConfig } from "@/app/features/profiles/services/obscur-data-root-service";
import { nativeLocalMediaAdapter } from "./native-local-media-adapter";
import { resolveVaultStorageLayout, vaultUsesAbsolutePaths } from "./local-media-vault-path";
import {
  buildOpaqueVaultFileName,
  decryptVaultFileBytesIfNeeded,
  encryptVaultBytesIfAvailable,
  isEncryptedVaultRelativePath,
} from "@/app/features/storage/services/vault-at-rest";
import { getProfileStorageKeyMaterial } from "@/app/features/storage/services/profile-storage-key-session";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { normalizeAttachmentUrl } from "@/app/shared/public-url";

type LocalMediaIndexEntry = Readonly<{
    remoteUrl: string;
    relativePath: string;
    savedAtUnixMs: number;
    fileName: string;
    contentType: string;
    size: number;
    messageEventId?: string;
    explicitChatSave?: boolean;
}>;

type LocalMediaIndex = Record<string, LocalMediaIndexEntry>;

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
}>;

const resolveVaultStorage = async (): Promise<ResolvedVaultStorage> => {
    const cfg = getLocalMediaStorageConfig();
    const effectivePath = isTauriRuntime()
        ? (await getObscurDataRootConfig()).effectivePath?.trim() || null
        : null;
    const layout = resolveVaultStorageLayout({
        isNative: isTauriRuntime(),
        dataRootEffectivePath: effectivePath,
        config: cfg,
    });
    let absoluteStorageDir: string | null = null;
    if (layout.mode === "unified_data_root" && effectivePath) {
        absoluteStorageDir = await nativeLocalMediaAdapter.joinPaths(effectivePath, cfg.subdir);
    } else if (layout.mode === "legacy_custom_root") {
        absoluteStorageDir = await nativeLocalMediaAdapter.joinPaths(cfg.customRootPath, cfg.subdir);
    }
    return {
        absoluteStorageDir,
        usesAbsolutePaths: vaultUsesAbsolutePaths(layout),
        unifiedDataRootPath: layout.mode === "unified_data_root" ? effectivePath : null,
    };
};

const resolveEntryAbsolutePath = async (entryPath: string): Promise<string> => {
    if (isAbsoluteStoragePath(entryPath)) {
        return entryPath;
    }
    const storage = await resolveVaultStorage();
    if (storage.unifiedDataRootPath) {
        return nativeLocalMediaAdapter.joinPaths(storage.unifiedDataRootPath, entryPath);
    }
    return buildAbsolutePath(entryPath);
};

const isTauriRuntime = (): boolean => {
    return hasNativeRuntime();
};

const isBrowser = (): boolean => typeof window !== "undefined";

const storageRefForEntryPath = (entryPath: string): Readonly<{ path: string; appDataRelative?: boolean }> => (
    isAbsoluteStoragePath(entryPath)
        ? { path: entryPath }
        : { path: entryPath, appDataRelative: true }
);
const scopedConfigKey = (profileId?: string): string => getScopedStorageKey(STORAGE_CONFIG_KEY, profileId);
const scopedIndexKey = (profileId?: string): string => getScopedStorageKey(STORAGE_INDEX_KEY, profileId);

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

const splitFileName = (fileName: string): Readonly<{ stem: string; ext: string | null }> => {
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex >= fileName.length - 1) {
        return { stem: fileName, ext: null };
    }
    const ext = fileName.slice(dotIndex + 1);
    if (!/^[a-z0-9]{1,8}$/i.test(ext)) {
        return { stem: fileName, ext: null };
    }
    return {
        stem: fileName.slice(0, dotIndex),
        ext,
    };
};

const withSuffix = (stem: string, ext: string | null, suffix: number): string => (
    ext ? `${stem}-${suffix}.${ext}` : `${stem}-${suffix}`
);

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
): Promise<Readonly<{ relativePath: string; fileName: string; encrypted: boolean }>> => {
    const profileId = getResolvedProfileId();
    const keyMaterialAvailable = Boolean(getProfileStorageKeyMaterial(profileId));
    if (keyMaterialAvailable && remoteUrl?.trim()) {
        const opaqueFileName = await buildOpaqueVaultFileName(remoteUrl, profileId);
        const storage = await resolveVaultStorage();
        const relativePath = storage.absoluteStorageDir
            ? await nativeLocalMediaAdapter.joinPaths(storage.absoluteStorageDir, opaqueFileName)
            : `${cfg.subdir}/${opaqueFileName}`;
        return { relativePath, fileName: opaqueFileName, encrypted: true };
    }
    const { stem, ext } = splitFileName(preferredFileName);
    const storage = await resolveVaultStorage();
    const absoluteRoot = storage.absoluteStorageDir;
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const fileName = attempt === 0 ? preferredFileName : withSuffix(stem, ext, attempt + 1);
        const relativePath = absoluteRoot
            ? await nativeLocalMediaAdapter.joinPaths(absoluteRoot, fileName)
            : `${cfg.subdir}/${fileName}`;
        const exists = absoluteRoot
            ? await nativeLocalMediaAdapter.fileExists({ path: relativePath })
            : await nativeLocalMediaAdapter.fileExists({ path: relativePath, appDataRelative: true });
        if (!exists) {
            return { relativePath, fileName, encrypted: false };
        }
    }
    const fallbackFileName = withSuffix(stem, ext, Date.now());
    const fallbackRelativePath = absoluteRoot
        ? await nativeLocalMediaAdapter.joinPaths(absoluteRoot, fallbackFileName)
        : `${cfg.subdir}/${fallbackFileName}`;
    return { relativePath: fallbackRelativePath, fileName: fallbackFileName, encrypted: false };
};

const loadIndex = (): LocalMediaIndex => {
    if (!isBrowser()) return {};
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

const saveIndex = (index: LocalMediaIndex): void => {
    if (!isBrowser()) return;
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
    let index: LocalMediaIndex = {};
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
    localStorage.setItem(scopedIndexKey(profileId), JSON.stringify(next));
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
        return;
    }
    const cfg = getLocalMediaStorageConfig();
    await ensureStorageDir(cfg.subdir);
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
        const entryRef = storageRefForEntryPath(entry.relativePath);
        const hasFile = await nativeLocalMediaAdapter.fileExists(entryRef);
        if (!hasFile) {
            delete index[normalizedRemoteUrl];
            saveIndex(index);
            return false;
        }
        const absolutePath = await resolveEntryAbsolutePath(entry.relativePath);
        const revealResult = await invokeNativeCommand<void>("desktop_reveal_path_in_file_manager", {
            path: absolutePath,
        });
        if (revealResult.ok) {
            return true;
        }
        return nativeLocalMediaAdapter.openPath(absolutePath);
    } catch {
        return false;
    }
};

export const resolveLocalMediaUrl = async (remoteUrl: string): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    const index = loadIndex();
    const entry = index[remoteUrl];
    if (!entry) return null;
    try {
        const cfg = getLocalMediaStorageConfig();
        const entryRef = storageRefForEntryPath(entry.relativePath);
        const hasFile = await nativeLocalMediaAdapter.fileExists(entryRef);
        if (!hasFile) {
            delete index[remoteUrl];
            saveIndex(index);
            return null;
        }
        const absolutePath = await resolveEntryAbsolutePath(entry.relativePath);
        if (isEncryptedVaultRelativePath(entry.relativePath)) {
            const fileBytes = await nativeLocalMediaAdapter.readBytes(storageRefForEntryPath(entry.relativePath));
            if (!fileBytes) {
                return null;
            }
            const decrypted = await decryptVaultFileBytesIfNeeded({ fileBytes });
            const blob = new Blob([decrypted.slice()], { type: entry.contentType || "application/octet-stream" });
            return URL.createObjectURL(blob);
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
    const fileBytes = await nativeLocalMediaAdapter.readBytes(storageRefForEntryPath(entry.relativePath));
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

export const cacheAttachmentLocally = async (
    attachment: Attachment,
    mode: "sent" | "received",
    localBytes?: Uint8Array,
    options?: Readonly<{ force?: boolean; messageEventId?: string; explicitChatSave?: boolean }>,
): Promise<string | null> => {
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

    try {
        await ensureStorageAbsoluteDir();
        const bytes = localBytes ?? await fetchBytes(attachment.url, attachment.contentType);

        // Ensure we don't save empty corrupted files
        if (bytes.byteLength === 0) {
            throw new Error("Cannot cache empty file (0 bytes)");
        }

        const preferredFileName = buildPreferredLocalFileName(attachment);
        const target = await resolveUniqueLocalFileTarget(cfg, preferredFileName, attachment.url);
        const relativePath = target.relativePath;
        const displayFileName = resolveVaultDisplayFileName({
            attachmentFileName: attachment.fileName,
            indexFileName: preferredFileName,
        });
        const encryptedPayload = await encryptVaultBytesIfAvailable({ plaintext: bytes });
        const payload = encryptedPayload.bytes;

        const storage = await resolveVaultStorage();
        if (storage.usesAbsolutePaths && storage.absoluteStorageDir) {
            await nativeLocalMediaAdapter.writeBytes({ path: relativePath, bytes: payload });
        } else {
            await nativeLocalMediaAdapter.writeBytes({ path: relativePath, appDataRelative: true, bytes: payload });
        }

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
        return resolveLocalMediaUrl(attachment.url);
    } catch (error) {
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
    attachment: Attachment,
    localBytes?: Uint8Array,
): Promise<string | null> => {
    const normalizedUrl = normalizeAttachmentUrl(attachment.url);
    if (!normalizedUrl) {
        return null;
    }
    return cacheAttachmentLocally(
        normalizedUrl === attachment.url ? attachment : { ...attachment, url: normalizedUrl },
        "received",
        localBytes,
        { force: true, explicitChatSave: true },
    );
};

export const saveFileToLocalVault = async (file: File): Promise<SaveFileToLocalVaultResult | null> => {
    if (!isTauriRuntime()) {
        return null;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength === 0) {
        throw new Error("Cannot save empty file (0 bytes)");
    }
    const contentType = file.type?.trim() || "application/octet-stream";
    const fileName = file.name?.trim() || "file";
    const contentHash = await sha256BytesHex(bytes);
    const vaultUrl = buildLocalVaultOnlyUrl(contentHash);
    const attachment: Attachment = {
        kind: inferAttachmentKindFromMeta(fileName, contentType),
        url: vaultUrl,
        contentType,
        fileName,
    };
    const existing = await resolveLocalMediaUrl(vaultUrl);
    if (existing) {
        return { vaultUrl, localUrl: existing, attachment };
    }
    const localUrl = await cacheAttachmentLocally(attachment, "sent", bytes, { force: true });
    if (!localUrl) {
        return null;
    }
    return { vaultUrl, localUrl, attachment };
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
                await nativeLocalMediaAdapter.removePath(storageRefForEntryPath(entry.relativePath));
            } catch {
                // Best-effort per-item deletion fallback.
            }
        }));
    }
    if (isBrowser()) {
        localStorage.removeItem(scopedIndexKey());
    }
};

export const deleteLocalMediaCacheItem = async (remoteUrl: string): Promise<boolean> => {
    if (!isTauriRuntime()) return false;
    const index = loadIndex();
    const entry = index[remoteUrl];
    if (!entry) return false;

    try {
        await nativeLocalMediaAdapter.removePath(storageRefForEntryPath(entry.relativePath));
    } catch {
        // Ignore file removal failures; still clean stale index below.
    }

    delete index[remoteUrl];
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

export const pickLocalMediaStorageRootPath = async (): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    try {
        return await nativeLocalMediaAdapter.pickDirectory();
    } catch {
        return null;
    }
};
