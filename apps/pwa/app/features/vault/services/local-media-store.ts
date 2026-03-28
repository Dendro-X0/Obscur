"use client";

import type { Attachment } from "../../messaging/types";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { nativeLocalMediaAdapter } from "./native-local-media-adapter";

type LocalMediaIndexEntry = Readonly<{
    remoteUrl: string;
    relativePath: string;
    savedAtUnixMs: number;
    fileName: string;
    contentType: string;
    size: number;
}>;

type LocalMediaIndex = Record<string, LocalMediaIndexEntry>;

export type LocalMediaStorageConfig = Readonly<{
    enabled: boolean;
    subdir: string;
    customRootPath: string;
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
let localCacheWriteBlocked = false;
let localCacheBlockedWarningEmitted = false;

export const DEFAULT_LOCAL_MEDIA_STORAGE_CONFIG: LocalMediaStorageConfig = {
    enabled: true,
    subdir: DEFAULT_SUBDIR,
    customRootPath: "",
    cacheSentFiles: true,
    cacheReceivedFiles: true,
};

const isTauriRuntime = (): boolean => {
    return hasNativeRuntime();
};

const isBrowser = (): boolean => typeof window !== "undefined";
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
): Promise<Readonly<{ relativePath: string; fileName: string }>> => {
    const { stem, ext } = splitFileName(preferredFileName);
    const absoluteRoot = cfg.customRootPath.trim().length > 0
        ? await resolveStorageAbsolutePath()
        : null;
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const fileName = attempt === 0 ? preferredFileName : withSuffix(stem, ext, attempt + 1);
        const relativePath = absoluteRoot
            ? await nativeLocalMediaAdapter.joinPaths(absoluteRoot, fileName)
            : `${cfg.subdir}/${fileName}`;
        const exists = absoluteRoot
            ? await nativeLocalMediaAdapter.fileExists({ path: relativePath })
            : await nativeLocalMediaAdapter.fileExists({ path: relativePath, appDataRelative: true });
        if (!exists) {
            return { relativePath, fileName };
        }
    }
    const fallbackFileName = withSuffix(stem, ext, Date.now());
    const fallbackRelativePath = absoluteRoot
        ? await nativeLocalMediaAdapter.joinPaths(absoluteRoot, fallbackFileName)
        : `${cfg.subdir}/${fallbackFileName}`;
    return { relativePath: fallbackRelativePath, fileName: fallbackFileName };
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
            ? normalizeLocalMediaDisplayFileName(entry.fileName)
            : normalizeLocalMediaDisplayFileName(normalizedRelativePath.split(/[\\/]/).pop() ?? "file");
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

export const getLocalMediaIndexEntryByRemoteUrl = (remoteUrl: string): LocalMediaIndexEntry | null => {
    const index = getLocalMediaIndexSnapshot();
    return index[remoteUrl] ?? null;
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
        customRootPath: config.customRootPath.trim(),
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
    const cfg = getLocalMediaStorageConfig();
    if (cfg.customRootPath.trim().length > 0) {
        return nativeLocalMediaAdapter.joinPaths(cfg.customRootPath, cfg.subdir);
    }
    return buildAbsolutePath(cfg.subdir);
};

const ensureStorageAbsoluteDir = async (): Promise<void> => {
    const cfg = getLocalMediaStorageConfig();
    if (cfg.customRootPath.trim().length > 0) {
        const absolutePath = await resolveStorageAbsolutePath();
        await nativeLocalMediaAdapter.ensureDirectory({ path: absolutePath });
        return;
    }
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

export const resolveLocalMediaUrl = async (remoteUrl: string): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    const index = loadIndex();
    const entry = index[remoteUrl];
    if (!entry) return null;
    try {
        const cfg = getLocalMediaStorageConfig();
        let hasFile = false;
        if (cfg.customRootPath.trim().length > 0) {
            hasFile = await nativeLocalMediaAdapter.fileExists({ path: entry.relativePath });
        } else {
            hasFile = await nativeLocalMediaAdapter.fileExists({ path: entry.relativePath, appDataRelative: true });
        }
        if (!hasFile) {
            delete index[remoteUrl];
            saveIndex(index);
            return null;
        }
        const absolutePath = cfg.customRootPath.trim().length > 0
            ? entry.relativePath
            : await buildAbsolutePath(entry.relativePath);
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

const fetchBytes = async (url: string): Promise<Uint8Array> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
        const res = await fetch(url, { method: "GET", signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
    } finally {
        clearTimeout(timeout);
    }
};

export const cacheAttachmentLocally = async (
    attachment: Attachment,
    mode: "sent" | "received",
    localBytes?: Uint8Array
): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    const cfg = getLocalMediaStorageConfig();
    if (!cfg.enabled) return null;
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
    if (mode === "sent" && !cfg.cacheSentFiles) return null;
    if (mode === "received" && !cfg.cacheReceivedFiles) return null;

    const existing = await resolveLocalMediaUrl(attachment.url);
    if (existing) return existing;

    try {
        await ensureStorageAbsoluteDir();
        const bytes = localBytes ?? await fetchBytes(attachment.url);

        // Ensure we don't save empty corrupted files
        if (bytes.byteLength === 0) {
            throw new Error("Cannot cache empty file (0 bytes)");
        }

        const preferredFileName = buildPreferredLocalFileName(attachment);
        const target = await resolveUniqueLocalFileTarget(cfg, preferredFileName);
        const fileName = target.fileName;
        const relativePath = target.relativePath;

        if (cfg.customRootPath.trim().length > 0) {
            await nativeLocalMediaAdapter.writeBytes({ path: relativePath, bytes });
        } else {
            await nativeLocalMediaAdapter.writeBytes({ path: relativePath, appDataRelative: true, bytes });
        }

        // Reload index to avoid race conditions when uploading multiple files concurrently
        const currentIndex = loadIndex();
        currentIndex[attachment.url] = {
            remoteUrl: attachment.url,
            relativePath,
            savedAtUnixMs: Date.now(),
            fileName,
            contentType: attachment.contentType,
            size: bytes.byteLength,
        };
        saveIndex(currentIndex);
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

export const purgeLocalMediaCache = async (): Promise<void> => {
    if (!isTauriRuntime()) return;
    localCacheWriteBlocked = false;
    localCacheBlockedWarningEmitted = false;
    const cfg = getLocalMediaStorageConfig();
    const indexSnapshot = loadIndex();
    let removedByRoot = false;
    try {
        if (cfg.customRootPath.trim().length > 0) {
            await nativeLocalMediaAdapter.removePath({ path: await resolveStorageAbsolutePath(), recursive: true });
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
                if (cfg.customRootPath.trim().length > 0) {
                    await nativeLocalMediaAdapter.removePath({ path: entry.relativePath });
                } else {
                    await nativeLocalMediaAdapter.removePath({ path: entry.relativePath, appDataRelative: true });
                }
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
        const cfg = getLocalMediaStorageConfig();
        if (cfg.customRootPath.trim().length > 0) {
            await nativeLocalMediaAdapter.removePath({ path: entry.relativePath });
        } else {
            await nativeLocalMediaAdapter.removePath({ path: entry.relativePath, appDataRelative: true });
        }
    } catch {
        // Ignore file removal failures; still clean stale index below.
    }

    delete index[remoteUrl];
    saveIndex(index);
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
