import { Attachment, AttachmentKind, UploadApiResponse } from "@/app/features/messaging/types";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export interface UploadService {
    uploadFile: (file: File) => Promise<Attachment>;
}

/**
 * Implementation of UploadService using the local /api/upload endpoint
 */
export class LocalUploadService implements UploadService {
    async uploadFile(file: File): Promise<Attachment> {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            let errorMessage = `Upload failed with status ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData && errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (e) {
                // Could not parse error JSON, fall back to status text
            }
            throw new Error(errorMessage);
        }

        const result: UploadApiResponse = await response.json();

        if (!result.ok) {
            throw new Error(result.error || "Upload failed");
        }

        const kind: AttachmentKind = result.contentType.startsWith("video/") ? "video" : "image";

        return {
            kind,
            url: result.url,
            contentType: result.contentType,
            fileName: file.name,
        };
    }
}

/**
 * Hook to use the upload service
 */
import { useMemo, useState } from "react";
import { Nip96UploadService, STORAGE_KEY_NIP96, Nip96Config } from "./nip96-upload-service";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";

export const useUploadService = (): UploadService => {
    const identity = useIdentity();
    const { publicKeyHex, privateKeyHex } = identity.state;

    const [config] = useState<Nip96Config | null>(() => {
        if (typeof window === "undefined") {
            return null;
        }
        try {
            const stored: string | null = localStorage.getItem(STORAGE_KEY_NIP96);
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                if (parsed && typeof parsed === "object") {
                    const record = parsed as Readonly<Record<string, unknown>>;
                    const apiUrl: unknown = record.apiUrl;
                    const enabled: unknown = record.enabled;
                    if (typeof apiUrl === "string" && typeof enabled === "boolean") {
                        return { apiUrl, enabled };
                    }
                }
            }

            // If no config found, and we are on Vercel or Tauri (Desktop), auto-enable a default
            const isVercel = window.location.hostname.includes("vercel.app");
            const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

            if (isVercel || isTauri) {
                const defaultConfig = {
                    apiUrl: "https://nostr.build/api/v2/upload/files",
                    enabled: true
                };
                localStorage.setItem(STORAGE_KEY_NIP96, JSON.stringify(defaultConfig));
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
        if (config?.enabled && config.apiUrl) {
            return new Nip96UploadService(
                config.apiUrl,
                resolvedPublicKeyHex,
                resolvedPrivateKeyHex
            );
        }
        return new LocalUploadService();
    }, [config, publicKeyHex, privateKeyHex]);
};
