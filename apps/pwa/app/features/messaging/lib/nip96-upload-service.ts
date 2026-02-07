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
        return typeof window !== 'undefined' && '__TAURI__' in window;
    }

    async uploadFile(file: File): Promise<Attachment> {
        if (this.isTauri()) {
            return this.uploadFileTauri(file);
        }
        return this.uploadFileWeb(file);
    }

    private async uploadFileTauri(file: File): Promise<Attachment> {
        try {
            // For Tauri, we need to save the file temporarily and pass the path
            // Since we can't directly access file paths from File objects in the browser,
            // we'll use the dialog plugin to let users select files
            // For now, we'll convert the File to a blob URL and use that
            // This is a temporary solution - ideally we'd use the file path directly

            // Create a temporary file path (this won't work - we need the actual file path)
            // Instead, we'll read the file as bytes and write it temporarily
            const { invoke } = await import('@tauri-apps/api/core');
            const { BaseDirectory, writeFile } = await import('@tauri-apps/plugin-fs');

            // Read file as array buffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Write to temp file
            const tempFileName = `upload_${Date.now()}_${file.name}`;
            await writeFile(tempFileName, uint8Array, { baseDir: BaseDirectory.Temp });

            // Get the temp file path
            const { join, tempDir } = await import('@tauri-apps/api/path');
            const tempDirPath = await tempDir();
            const filePath = await join(tempDirPath, tempFileName);

            // Prepare NIP-98 auth header if we have keys
            let authHeader: string | null = null;
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

                    authHeader = btoa(JSON.stringify(event));
                } catch (err) {
                    console.error("Failed to sign NIP-98 event:", err);
                }
            }

            // Call Tauri command
            const url = await invoke<string>('upload_file_nip96', {
                filePath,
                apiUrl: this.apiUrl.trim(),
                authHeader
            });

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

        // Sanitize URL
        const endpoint = this.apiUrl.trim();

        // If we have keys, use NIP-98 Authorization
        if (this.publicKeyHex && this.privateKeyHex) {
            try {
                const event = await cryptoService.signEvent({
                    kind: 27235,
                    content: "",
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [
                        ["u", endpoint],
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

        const response = await fetch(endpoint, {
            method: "POST",
            body: formData,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NIP-96 Upload failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log("NIP-96 Response:", result);

        // Check for application-level errors even if HTTP status was 200
        if (result.status === 'error' || result.error) {
            throw new Error(result.message || result.error || "Unknown API error");
        }

        // NIP-96 successful response contains a 'nip94_event' or 'url'
        // Some providers might wrap it in 'data' or use 'link'
        const url =
            result.url ||
            (result.nip94_event?.tags?.find((t: string[]) => t[0] === 'url')?.[1]) ||
            result.data?.url ||
            result.data?.[0]?.url ||
            result.link;

        if (!url) {
            // Check for processing_url (async processing)
            if (result.processing_url) {
                throw new Error("File is processing significantly. Please try a different provider or smaller file.");
            }
            // If we have a message but no URL, it might be a soft error or warning we missed above
            if (result.message) {
                throw new Error(`Upload returned message: ${result.message}`);
            }

            const keys = Object.keys(result).join(", ");
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
