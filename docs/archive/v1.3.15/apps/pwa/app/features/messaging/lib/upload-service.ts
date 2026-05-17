import { Attachment, AttachmentKind, UploadApiResponse, UploadError, UploadErrorCode } from "../types";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { hasNativeRuntime, shouldAutoEnableDefaultUploadProviders } from "@/app/features/runtime/runtime-capabilities";
import { normalizePublicUrl } from "@/app/shared/public-url";
import { pickNativeFiles, readNativeFileBytes } from "@/app/features/runtime/native-host-adapter";
import { parseVoiceNoteFileName } from "@/app/features/messaging/services/voice-note-metadata";

export interface UploadService {
    uploadFile: (file: File) => Promise<Attachment>;
    pickFiles: () => Promise<File[] | null>;
}

const PICKABLE_EXTENSIONS = [
    "png", "jpg", "jpeg", "gif", "webp",
    "mp4", "mov", "avi", "webm", "mkv",
    "mp3", "wav", "m4a", "ogg", "aac", "flac", "opus",
    "pdf", "txt", "csv", "rtf",
    "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "odt", "ods", "odp"
] as const;

const PICKABLE_ACCEPT_STRING = [
    "image/*",
    "video/*",
    "audio/*",
    ".pdf,.txt,.csv,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp"
].join(",");

/**
 * Enhanced media kind detection with extension fallback
 */
export function getAttachmentKind(file: File): AttachmentKind {
    if (parseVoiceNoteFileName(file.name).isVoiceNote) {
        return "voice_note";
    }

    const type = file.type.toLowerCase();
    if (type.startsWith("video/")) return "video";
    if (type.startsWith("audio/")) return "audio";
    if (type.startsWith("image/")) return "image";

    // Fallback to extension check for cases where browser fails to detect MIME type
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const videoExtensions = ["mp4", "mov", "avi", "webm", "ogv", "m4v", "3gp", "mkv"];
    const audioExtensions = ["mp3", "wav", "m4a", "ogg", "aac", "flac", "opus"];

    if (videoExtensions.includes(extension)) return "video";
    if (audioExtensions.includes(extension)) return "audio";

    return "file";
}

/**
 * Common MIME type detection from extension
 */
export function getMimeType(fileName: string, defaultType: string = "application/octet-stream"): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const imageTypes: Record<string, string> = { "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp" };
    const videoTypes: Record<string, string> = { "mp4": "video/mp4", "mov": "video/quicktime", "avi": "video/x-msvideo", "webm": "video/webm", "ogv": "video/ogg" };
    const audioTypes: Record<string, string> = { "mp3": "audio/mpeg", "wav": "audio/wav", "m4a": "audio/mp4", "ogg": "audio/ogg", "aac": "audio/aac", "flac": "audio/flac", "opus": "audio/opus" };
    const documentTypes: Record<string, string> = {
        "pdf": "application/pdf",
        "txt": "text/plain",
        "csv": "text/csv",
        "rtf": "application/rtf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls": "application/vnd.ms-excel",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt": "application/vnd.ms-powerpoint",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "odt": "application/vnd.oasis.opendocument.text",
        "ods": "application/vnd.oasis.opendocument.spreadsheet",
        "odp": "application/vnd.oasis.opendocument.presentation"
    };

    return imageTypes[ext] || videoTypes[ext] || audioTypes[ext] || documentTypes[ext] || defaultType;
}

/**
 * Implementation of UploadService using the local /api/upload endpoint
 */
export class LocalUploadService implements UploadService {
    uploadFile = async (file: File): Promise<Attachment> => {
        const formData = new FormData();
        formData.append("file", file);

        let response: Response;
        try {
            response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
        } catch (e) {
            throw new UploadError(UploadErrorCode.NETWORK_ERROR, `Fetch failed: ${e}`);
        }

        if (!response.ok) {
            let errorMessage = `Upload failed with status ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch {
                // Could not parse error JSON, fall back to status text
            }
            throw new UploadError(UploadErrorCode.PROVIDER_ERROR, errorMessage);
        }

        const result: UploadApiResponse = await response.json();

        if (!result.ok) {
            throw new UploadError(UploadErrorCode.PROVIDER_ERROR, result.error || "Upload failed");
        }

        const kind: AttachmentKind = getAttachmentKind(file);

        return {
            kind,
            url: normalizePublicUrl(result.url),
            contentType: result.contentType,
            fileName: file.name,
        };
    }

    pickFiles = async (): Promise<File[] | null> => {
        return pickFilesInternal();
    }
}

/**
 * Shared internal helper for picking files across services
 */
export async function pickFilesInternal(): Promise<File[] | null> {
    const isTauri = hasNativeRuntime();

    if (isTauri) {
        try {
            const paths = await pickNativeFiles({
                multiple: true,
                extensions: [...PICKABLE_EXTENSIONS]
            });
            if (!paths || paths.length === 0) return null;
            const files: File[] = [];

            for (const path of paths) {
                const data = await readNativeFileBytes(path);
                if (!data) {
                    continue;
                }
                const fileName = path.split(/[\\/]/).pop() || "file";
                const fileBytes = new Uint8Array(data);
                const fileBuffer = fileBytes.buffer.slice(
                    fileBytes.byteOffset,
                    fileBytes.byteOffset + fileBytes.byteLength
                );

                const type = getMimeType(fileName);
                files.push(new File([fileBuffer], fileName, { type }));
            }
            return files;
        } catch (e) {
            console.error("Native pick failed, falling back to browser:", e);
        }
    }

    // Browser fallback
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = PICKABLE_ACCEPT_STRING;
        input.onchange = () => {
            const files = input.files ? Array.from(input.files) : null;
            resolve(files);
        };
        input.oncancel = () => resolve(null);
        input.click();
    });
}

/**
 * Hook to use the upload service
 */
import { useMemo, useState } from "react";
import { Nip96UploadService, getNip96StorageKey, Nip96Config } from "./nip96-upload-service";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";

const LEGACY_PROVIDER_URL_REWRITES: Readonly<Record<string, string>> = {
    "https://nostr.build/api/v2/upload/files": "https://nostr.build/api/v2/nip96/upload",
    "https://sovbit.host/api/v2/upload/files": "https://api.sovbit.host/api/upload/files",
};

const DEFAULT_NIP96_PROVIDER_URLS: ReadonlyArray<string> = [
    "https://nostr.build/api/v2/nip96/upload",
    "https://cdn.nostrcheck.me",
];

const normalizeProviderUrls = (params: Readonly<{ apiUrl?: string; apiUrls?: ReadonlyArray<string> }>): ReadonlyArray<string> => {
    const urlsFromList: ReadonlyArray<string> = Array.isArray(params.apiUrls) ? params.apiUrls : [];
    const urlsFromSingle: ReadonlyArray<string> = typeof params.apiUrl === "string" ? [params.apiUrl] : [];
    const rewritten = [...urlsFromList, ...urlsFromSingle]
        .map((value: string): string => value.trim())
        .filter((value: string): boolean => value.length > 0)
        .map((value: string): string => LEGACY_PROVIDER_URL_REWRITES[value] ?? value);
    return Array.from(new Set(rewritten));
};

export const useUploadService = (): UploadService => {
    const identity = useIdentity();
    const { publicKeyHex, privateKeyHex } = identity.state;

    const [config] = useState<Nip96Config | null>(() => {
        if (typeof window === "undefined") {
            return null;
        }
        try {
            const stored: string | null = localStorage.getItem(getNip96StorageKey());
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                if (parsed && typeof parsed === "object") {
                    const record = parsed as Readonly<Record<string, unknown>>;
                    const apiUrl: unknown = record.apiUrl;
                    const apiUrls: unknown = record.apiUrls;
                    const enabled: unknown = record.enabled;
                    if (typeof enabled === "boolean") {
                        const normalizedApiUrls = normalizeProviderUrls({
                            apiUrl: typeof apiUrl === "string" ? apiUrl : undefined,
                            apiUrls: Array.isArray(apiUrls) ? apiUrls.filter((v: unknown): v is string => typeof v === "string") : undefined
                        });
                        if (normalizedApiUrls.length > 0) {
                            const nextConfig: Nip96Config = { apiUrls: normalizedApiUrls, enabled };
                            localStorage.setItem(getNip96StorageKey(), JSON.stringify(nextConfig));
                            return nextConfig;
                        }
                    }
                }
            }

            if (shouldAutoEnableDefaultUploadProviders()) {
                const defaultConfig: Nip96Config = {
                    apiUrls: DEFAULT_NIP96_PROVIDER_URLS,
                    enabled: true
                };
                localStorage.setItem(getNip96StorageKey(), JSON.stringify(defaultConfig));
                return defaultConfig;
            }

            return null;
        } catch {
            return null;
        }
    });

    return useMemo(() => {
        const resolvedPublicKeyHex: PublicKeyHex | null = typeof publicKeyHex === "string" ? (publicKeyHex as PublicKeyHex) : null;
        const resolvedPrivateKeyHex: PrivateKeyHex | null = typeof privateKeyHex === "string" ? (privateKeyHex as PrivateKeyHex) : null;
        const providerUrls = config?.enabled ? normalizeProviderUrls(config) : [];
        if (config?.enabled && providerUrls.length > 0) {
            return new Nip96UploadService(
                providerUrls,
                resolvedPublicKeyHex,
                resolvedPrivateKeyHex
            );
        }
        return new LocalUploadService();
    }, [config, publicKeyHex, privateKeyHex]);
};

export const uploadServiceInternals = {
    normalizeProviderUrls,
    DEFAULT_NIP96_PROVIDER_URLS,
    LEGACY_PROVIDER_URL_REWRITES,
};
