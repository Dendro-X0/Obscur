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

    async uploadFile(file: File): Promise<Attachment> {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("caption", file.name);

        const headers: Record<string, string> = {};

        // If we have keys, use NIP-98 Authorization
        if (this.publicKeyHex && this.privateKeyHex) {
            try {
                const event = await cryptoService.signEvent({
                    kind: 27235,
                    content: "",
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [
                        ["u", this.apiUrl],
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

        const response = await fetch(this.apiUrl, {
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
