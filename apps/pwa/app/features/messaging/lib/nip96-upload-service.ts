import { Attachment, AttachmentKind } from "../types";
import { UploadService } from "./upload-service";
import { cryptoService } from "../../crypto/crypto-service";
import { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

export interface Nip96Config {
    apiUrl: string;
    enabled: boolean;
}

export const STORAGE_KEY_NIP96 = "obscur.storage.nip96";

/**
 * Implementation of UploadService using NIP-96 (Nostr HTTP File Upload)
 * Supports NIP-98 Authorization
 */
export class Nip96UploadService implements UploadService {
    constructor(
        private readonly apiUrl: string,
        private readonly publicKeyHex: PublicKeyHex | null,
        private readonly privateKeyHex: PrivateKeyHex | null
    ) { }

    private isTauri(): boolean {
        if (typeof window === "undefined") {
            return false;
        }
        const w = window as unknown as Record<string, unknown>;
        return "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
    }

    async uploadFile(file: File): Promise<Attachment> {
        if (this.isTauri()) {
            return this.uploadFileTauri(file);
        }
        return this.uploadFileWeb(file);
    }

    /**
     * Tauri-specific upload using native file system and upload plugin.
     * This bypasses WebView CORS restrictions by:
     * 1. Writing the file to a temp directory
     * 2. Using the native upload plugin with the file path
     * 3. Cleaning up the temp file
     */
    private async uploadFileTauri(file: File): Promise<Attachment> {
        try {
            const { upload } = await import('@tauri-apps/plugin-upload');
            const { tempDir, join } = await import('@tauri-apps/api/path');
            const { writeFile, remove } = await import('@tauri-apps/plugin-fs');

            // Create a unique temp file path
            const tempDirectory = await tempDir();
            const uniqueId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const extension = file.name.split('.').pop() || 'tmp';
            const tempFilePath = await join(tempDirectory, `${uniqueId}.${extension}`);

            // Write the file to temp directory
            const arrayBuffer = await file.arrayBuffer();
            await writeFile(tempFilePath, new Uint8Array(arrayBuffer));

            // Prepare NIP-98 auth header if we have keys
            const headersMap = new Map<string, string>();
            headersMap.set('Content-Type', file.type || 'application/octet-stream');

            if (this.publicKeyHex && this.privateKeyHex) {
                try {
                    const event = await cryptoService.signEvent({
                        kind: 27235,
                        content: "",
                        created_at: Math.floor(Date.now() / 1000),
                        tags: [
                            ["u", this.apiUrl.trim()],
                            ["method", "POST"]
                        ],
                        pubkey: this.publicKeyHex
                    }, this.privateKeyHex);

                    const auth = btoa(JSON.stringify(event));
                    headersMap.set("Authorization", `Nostr ${auth}`);
                } catch (err) {
                    console.error("Failed to sign NIP-98 event:", err);
                }
            }

            let response: string;
            try {
                // Use the native upload plugin with file path
                response = await upload(
                    this.apiUrl.trim(),
                    tempFilePath,
                    (payload) => {
                        console.log(`Upload progress: ${payload.progress} / ${payload.total}`);
                    },
                    headersMap
                );
            } finally {
                // Clean up temp file
                try {
                    await remove(tempFilePath);
                } catch (cleanupError) {
                    console.warn("Failed to clean up temp file:", cleanupError);
                }
            }

            // Parse the response
            const result = JSON.parse(response);
            const typedResult = result as any;

            if (typedResult.status === 'error' || typedResult.error) {
                throw new Error(typedResult.message || typedResult.error || "Unknown API error");
            }

            const url =
                typedResult.url ||
                (typedResult.nip94_event?.tags?.find((t: string[]) => t[0] === 'url')?.[1]) ||
                typedResult.data?.url ||
                typedResult.data?.[0]?.url ||
                typedResult.link;

            if (!url) {
                if (typedResult.processing_url) {
                    throw new Error("File is processing significantly. Please try a different provider or smaller file.");
                }
                if (typedResult.message) {
                    throw new Error(`Upload returned message: ${typedResult.message}`);
                }
                const keys = Object.keys(typedResult).join(", ");
                throw new Error(`NIP-96 response missing URL. Keys received: [${keys}]`);
            }

            const kind: AttachmentKind = file.type.startsWith("video/") ? "video" : "image";

            return {
                kind,
                url,
                contentType: file.type,
                fileName: file.name,
            };

        } catch (error) {
            console.error("Tauri upload failed:", error);
            throw new Error(`Upload failed: ${error}`);
        }
    }

    private async uploadFileWeb(file: File): Promise<Attachment> {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("caption", file.name);

        const headers: Record<string, string> = {};
        if (this.publicKeyHex && this.privateKeyHex) {
            try {
                const event = await cryptoService.signEvent({
                    kind: 27235,
                    content: "",
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [
                        ["u", this.apiUrl.trim()],
                        ["method", "POST"]
                    ],
                    pubkey: this.publicKeyHex
                }, this.privateKeyHex);

                const auth = btoa(JSON.stringify(event));
                headers["Authorization"] = `Nostr ${auth}`;
            } catch (err) {
                console.error("Failed to sign NIP-98 event:", err);
            }
        }

        const response = await fetch(this.apiUrl.trim(), {
            method: "POST",
            body: formData,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NIP-96 Upload failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        const typedResult = result as any;

        if (typedResult.status === 'error' || typedResult.error) {
            throw new Error(typedResult.message || typedResult.error || "Unknown API error");
        }

        const url =
            typedResult.url ||
            (typedResult.nip94_event?.tags?.find((t: string[]) => t[0] === 'url')?.[1]) ||
            typedResult.data?.url ||
            typedResult.data?.[0]?.url ||
            typedResult.link;

        if (!url) {
            if (typedResult.processing_url) {
                throw new Error("File is processing significantly. Please try a different provider or smaller file.");
            }
            if (typedResult.message) {
                throw new Error(`Upload returned message: ${typedResult.message}`);
            }
            const keys = Object.keys(typedResult).join(", ");
            throw new Error(`NIP-96 response missing URL. Keys received: [${keys}]`);
        }

        const kind: AttachmentKind = file.type.startsWith("video/") ? "video" : "image";

        return {
            kind,
            url,
            contentType: file.type,
            fileName: file.name,
        };
    }
}
