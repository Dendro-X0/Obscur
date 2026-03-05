"use client";

import type { Attachment } from "../../messaging/types";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

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

const DEFAULT_CONFIG: LocalMediaStorageConfig = {
    enabled: true,
    subdir: DEFAULT_SUBDIR,
    customRootPath: "",
    cacheSentFiles: true,
    cacheReceivedFiles: true,
};

const isTauriRuntime = (): boolean => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
};

const isBrowser = (): boolean => typeof window !== "undefined";

const sanitizeSubdir = (raw: string): string => {
    const clean = raw.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    return clean.length > 0 ? clean : DEFAULT_SUBDIR;
};

const sanitizeFileName = (raw: string): string => {
    const file = raw.trim();
    const cleaned = file.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
    return cleaned.length > 0 ? cleaned : "file";
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

const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

const hashUrl = async (url: string): Promise<string> => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
    return toHex(new Uint8Array(digest)).slice(0, 24);
};

const loadIndex = (): LocalMediaIndex => {
    if (!isBrowser()) return {};
    try {
        const raw = localStorage.getItem(STORAGE_INDEX_KEY);
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
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
};

export const getLocalMediaIndexEntryByRemoteUrl = (remoteUrl: string): LocalMediaIndexEntry | null => {
    const index = getLocalMediaIndexSnapshot();
    return index[remoteUrl] ?? null;
};

export const getLocalMediaStorageConfig = (): LocalMediaStorageConfig => {
    if (!isBrowser()) return DEFAULT_CONFIG;
    try {
        const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
        if (!raw) return DEFAULT_CONFIG;
        const parsed = JSON.parse(raw) as Partial<LocalMediaStorageConfig>;
        return {
            enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
            subdir: sanitizeSubdir(parsed.subdir ?? DEFAULT_CONFIG.subdir),
            customRootPath: typeof parsed.customRootPath === "string" ? parsed.customRootPath.trim() : DEFAULT_CONFIG.customRootPath,
            cacheSentFiles: parsed.cacheSentFiles ?? DEFAULT_CONFIG.cacheSentFiles,
            cacheReceivedFiles: parsed.cacheReceivedFiles ?? DEFAULT_CONFIG.cacheReceivedFiles,
        };
    } catch {
        return DEFAULT_CONFIG;
    }
};

export const saveLocalMediaStorageConfig = (config: LocalMediaStorageConfig): LocalMediaStorageConfig => {
    const normalized: LocalMediaStorageConfig = {
        enabled: config.enabled,
        subdir: sanitizeSubdir(config.subdir),
        customRootPath: config.customRootPath.trim(),
        cacheSentFiles: config.cacheSentFiles,
        cacheReceivedFiles: config.cacheReceivedFiles,
    };
    if (isBrowser()) {
        localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(normalized));
    }
    return normalized;
};

const ensureStorageDir = async (subdir: string): Promise<void> => {
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory } = await import("@tauri-apps/api/path");
    await mkdir(subdir, { baseDir: BaseDirectory.AppData, recursive: true });
};

const buildAbsolutePath = async (relativePath: string): Promise<string> => {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const root = await appDataDir();
    return join(root, relativePath);
};

const resolveStorageAbsolutePath = async (): Promise<string> => {
    const cfg = getLocalMediaStorageConfig();
    const { join } = await import("@tauri-apps/api/path");
    if (cfg.customRootPath.trim().length > 0) {
        return join(cfg.customRootPath, cfg.subdir);
    }
    return buildAbsolutePath(cfg.subdir);
};

const ensureStorageAbsoluteDir = async (): Promise<void> => {
    const cfg = getLocalMediaStorageConfig();
    if (cfg.customRootPath.trim().length > 0) {
        const { mkdir } = await import("@tauri-apps/plugin-fs");
        const absolutePath = await resolveStorageAbsolutePath();
        await mkdir(absolutePath, { recursive: true });
        return;
    }
    await ensureStorageDir(cfg.subdir);
};

export const getLocalMediaStorageAbsolutePath = async (): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    return resolveStorageAbsolutePath();
};

export const openLocalMediaStoragePath = async (): Promise<void> => {
    if (!isTauriRuntime()) return;
    const path = await getLocalMediaStorageAbsolutePath();
    if (!path) return;
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(path);
};

export const resolveLocalMediaUrl = async (remoteUrl: string): Promise<string | null> => {
    if (!isTauriRuntime()) return null;
    const index = loadIndex();
    const entry = index[remoteUrl];
    if (!entry) return null;
    try {
        const { exists } = await import("@tauri-apps/plugin-fs");
        const cfg = getLocalMediaStorageConfig();
        let hasFile = false;
        if (cfg.customRootPath.trim().length > 0) {
            hasFile = await exists(entry.relativePath);
        } else {
            const { BaseDirectory } = await import("@tauri-apps/api/path");
            hasFile = await exists(entry.relativePath, { baseDir: BaseDirectory.AppData });
        }
        if (!hasFile) {
            delete index[remoteUrl];
            saveIndex(index);
            return null;
        }
        const absolutePath = cfg.customRootPath.trim().length > 0
            ? entry.relativePath
            : await buildAbsolutePath(entry.relativePath);
        const { convertFileSrc } = await import("@tauri-apps/api/core");
        return convertFileSrc(absolutePath);
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

        const urlHash = await hashUrl(attachment.url);
        const ext = inferExtension(attachment);
        const baseName = sanitizeFileName(attachment.fileName.replace(/\.[^.]+$/, ""));
        const fileName = `${Date.now()}-${urlHash}-${baseName}.${ext}`;
        const relativePath = cfg.customRootPath.trim().length > 0
            ? await (await import("@tauri-apps/api/path")).join(await resolveStorageAbsolutePath(), fileName)
            : `${cfg.subdir}/${fileName}`;

        const { writeFile } = await import("@tauri-apps/plugin-fs");
        if (cfg.customRootPath.trim().length > 0) {
            await writeFile(relativePath, bytes);
        } else {
            const { BaseDirectory } = await import("@tauri-apps/api/path");
            await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppData, create: true });
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
    try {
        const { remove } = await import("@tauri-apps/plugin-fs");
        if (cfg.customRootPath.trim().length > 0) {
            await remove(await resolveStorageAbsolutePath(), { recursive: true });
        } else {
            const { BaseDirectory } = await import("@tauri-apps/api/path");
            await remove(cfg.subdir, { baseDir: BaseDirectory.AppData, recursive: true });
        }
    } catch {
        // ignore
    }
    if (isBrowser()) {
        localStorage.removeItem(STORAGE_INDEX_KEY);
    }
};

export const deleteLocalMediaCacheItem = async (remoteUrl: string): Promise<boolean> => {
    if (!isTauriRuntime()) return false;
    const index = loadIndex();
    const entry = index[remoteUrl];
    if (!entry) return false;

    try {
        const { remove } = await import("@tauri-apps/plugin-fs");
        const cfg = getLocalMediaStorageConfig();
        if (cfg.customRootPath.trim().length > 0) {
            await remove(entry.relativePath);
        } else {
            const { BaseDirectory } = await import("@tauri-apps/api/path");
            await remove(entry.relativePath, { baseDir: BaseDirectory.AppData });
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
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ directory: true, multiple: false });
        if (typeof selected !== "string" || selected.trim().length === 0) return null;
        return selected;
    } catch {
        return null;
    }
};
