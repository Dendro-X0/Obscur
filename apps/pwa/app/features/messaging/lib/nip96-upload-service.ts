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
            const { upload } = await import('@tauri-apps/plugin-upload');

            // Prepare NIP-98 auth header if we have keys
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

            // Use the dedicated upload plugin which handles files natively
            const response = await upload(
                this.apiUrl.trim(),
                file,
                ({ progress, total }: { progress: number; total: number }) => {
                    console.log(`Upload progress: ${progress} / ${total}`);
                },
                headers,
                {
                    // Additional form data for NIP-96
                    caption: file.name
                }
            );

            // Check for application-level errors
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
