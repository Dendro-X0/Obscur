import { Attachment, AttachmentKind } from "../types";
import { UploadService } from "./upload-service";
import { cryptoService } from "../../crypto/crypto-service";
import { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { nativeErrorStore } from "../../native/lib/native-error-store";

export interface Nip96Config {
    apiUrl?: string;
    apiUrls?: ReadonlyArray<string>;
    enabled: boolean;
}

export const STORAGE_KEY_NIP96 = "obscur.storage.nip96";

type Nip96Event = Readonly<{
    tags?: ReadonlyArray<ReadonlyArray<string>>;
}>;

type Nip96Response = Readonly<Record<string, unknown>>;

const getStringProp = (obj: Nip96Response, key: string): string | null => {
    const value = obj[key];
    return typeof value === "string" ? value : null;
};

const getNip94UrlTag = (obj: Nip96Response): string | null => {
    const nip94EventValue = obj["nip94_event"];
    if (!nip94EventValue || typeof nip94EventValue !== "object") {
        return null;
    }
    const nip94Event = nip94EventValue as Nip96Event;
    const tags = nip94Event.tags;
    if (!Array.isArray(tags)) {
        return null;
    }
    const urlTag = tags.find((t: ReadonlyArray<string>) => t[0] === "url");
    if (!urlTag) {
        return null;
    }
    const url = urlTag[1];
    return typeof url === "string" ? url : null;
};

const getUrlFromNip96Response = (obj: Nip96Response): string | null => {
    const url = getStringProp(obj, "url") ?? getNip94UrlTag(obj) ?? getStringProp(obj, "link");
    if (url) {
        return url;
    }
    const dataValue = obj["data"];
    if (!dataValue) {
        return null;
    }
    if (Array.isArray(dataValue)) {
        const first = dataValue[0];
        if (first && typeof first === "object") {
            return getStringProp(first as Nip96Response, "url");
        }
        return null;
    }
    if (typeof dataValue === "object") {
        return getStringProp(dataValue as Nip96Response, "url");
    }
    return null;
};

/**
 * Implementation of UploadService using NIP-96 (Nostr HTTP File Upload)
 * Supports NIP-98 Authorization
 */
export class Nip96UploadService implements UploadService {
    constructor(
        private readonly apiUrls: ReadonlyArray<string>,
        private readonly publicKeyHex: PublicKeyHex | null,
        private readonly privateKeyHex: PrivateKeyHex | null
    ) { }

    private getProviders(): ReadonlyArray<string> {
        return this.apiUrls
            .map((value: string): string => value.trim())
            .filter((value: string): boolean => value.length > 0);
    }

    private isTauri(): boolean {
        if (typeof window === "undefined") {
            return false;
        }
        const w = window as unknown as Record<string, unknown>;
        return "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
    }

    async uploadFile(file: File): Promise<Attachment> {
        const providers = this.getProviders();
        if (providers.length === 0) {
            throw new Error("Upload failed: no NIP-96 providers configured");
        }
        const errors: string[] = [];
        for (const providerUrl of providers) {
            try {
                if (this.isTauri()) {
                    return await this.uploadFileTauri({ file, apiUrl: providerUrl });
                }
                return await this.uploadFileWeb({ file, apiUrl: providerUrl });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                errors.push(`${providerUrl}: ${message}`);
            }
        }
        throw new Error(`Upload failed: all providers rejected the upload. ${errors.join(" | ")}`);
    }

    /**
     * Tauri-specific upload using native file system and upload plugin.
     * This bypasses WebView CORS restrictions by:
     * 1. Writing the file to a temp directory
     * 2. Using the native upload plugin with the file path
     * 3. Cleaning up the temp file
     */
    /**
     * Tauri-specific upload using native Rust backend.
     * 1. Writes file to temp dir (to get a path).
     * 2. Calls native `nip96_upload` command.
     */
    private async uploadFileTauri(params: Readonly<{ file: File; apiUrl: string }>): Promise<Attachment> {
        let tempFilePath: string | null = null;
        try {
            const { invoke } = await import("@tauri-apps/api/core");
            const { tempDir, join } = await import("@tauri-apps/api/path");
            const { writeFile, remove } = await import("@tauri-apps/plugin-fs");

            // 1. Write to temp file to get a path (IPC optimization: avoid sending bytes to upload cmd)
            const tempDirectory = await tempDir();
            const uniqueId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const extension = params.file.name.split(".").pop() || "tmp";
            tempFilePath = await join(tempDirectory, `${uniqueId}.${extension}`);

            const arrayBuffer = await params.file.arrayBuffer();
            await writeFile(tempFilePath, new Uint8Array(arrayBuffer));

            // 2. Prepare Auth
            let authorization: string | null = null;
            if (this.publicKeyHex && this.privateKeyHex) {
                try {
                    const event = await cryptoService.signEvent({
                        kind: 27235,
                        content: "",
                        created_at: Math.floor(Date.now() / 1000),
                        tags: [
                            ["u", params.apiUrl.trim()],
                            ["method", "POST"]
                        ],
                        pubkey: this.publicKeyHex
                    }, this.privateKeyHex);
                    authorization = `Nostr ${btoa(JSON.stringify(event))}`;
                } catch (err) {
                    console.error("Failed to sign NIP-98 event:", err);
                }
            }

            // 3. Call Native Command
            // Response type matches UploadResponse in Rust
            interface NativeResponse {
                status: string;
                message?: string;
                original_response: string;
            }

            const response = await invoke<NativeResponse>("nip96_upload", {
                apiUrl: params.apiUrl.trim(),
                filePath: tempFilePath,
                contentType: params.file.type || "application/octet-stream",
                authorization
            });

            // 4. Handle Result
            if (response.status === "error") {
                throw new Error(response.message || "Native upload failed");
            }

            // Parse the original NIP-96 JSON response
            let typedResult: Nip96Response;
            try {
                typedResult = JSON.parse(response.original_response);
            } catch (e) {
                throw new Error(`Failed to parse NIP-96 response: ${e}`);
            }

            const status = typedResult["status"];
            const error = typedResult["error"];
            if (status === "error" || typeof error === "string") {
                const messageValue = typedResult["message"];
                const message = typeof messageValue === "string" ? messageValue : "Unknown API error";
                throw new Error(typeof error === "string" ? error : message);
            }

            const url = getUrlFromNip96Response(typedResult);
            if (!url) {
                if (typeof typedResult["processing_url"] === "string") {
                    throw new Error("File is processing significantly. Please try a different provider or smaller file.");
                }
                const messageValue = typedResult["message"];
                if (typeof messageValue === "string") {
                    throw new Error(`Upload returned message: ${messageValue}`);
                }
                const keys = Object.keys(typedResult).join(", ");
                throw new Error(`NIP-96 response missing URL. Keys received: [${keys}]`);
            }

            const kind: AttachmentKind = params.file.type.startsWith("video/") ? "video" : "image";
            return {
                kind,
                url,
                contentType: params.file.type,
                fileName: params.file.name,
            };

        } catch (error) {
            console.error("Tauri native upload failed:", error);
            const message = error instanceof Error ? error.message : String(error);
            nativeErrorStore.addError({
                code: "UPLOAD_FAILED",
                message: `Upload failed: ${message}`,
                retryable: true,
                retry: () => this.uploadFileTauri(params).then(() => { })
            });
            throw new Error(`Upload failed: ${error}`);
        } finally {
            if (tempFilePath) {
                try {
                    const { remove } = await import("@tauri-apps/plugin-fs");
                    await remove(tempFilePath);
                } catch (e) {
                    console.warn("Failed to clean up temp file:", e);
                }
            }
        }
    }

    private async uploadFileWeb(params: Readonly<{ file: File; apiUrl: string }>): Promise<Attachment> {
        const formData = new FormData();
        formData.append("file", params.file);
        formData.append("caption", params.file.name);

        const headers: Record<string, string> = {};
        if (this.publicKeyHex && this.privateKeyHex) {
            try {
                const event = await cryptoService.signEvent({
                    kind: 27235,
                    content: "",
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [
                        ["u", params.apiUrl.trim()],
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

        const response = await fetch(params.apiUrl.trim(), {
            method: "POST",
            body: formData,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NIP-96 Upload failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        const typedResult = result as Nip96Response;
        const status = typedResult["status"];
        const error = typedResult["error"];
        if (status === "error" || typeof error === "string") {
            const messageValue = typedResult["message"];
            const message = typeof messageValue === "string" ? messageValue : "Unknown API error";
            throw new Error(typeof error === "string" ? error : message);
        }

        const url = getUrlFromNip96Response(typedResult);

        if (!url) {
            if (typeof typedResult["processing_url"] === "string") {
                throw new Error("File is processing significantly. Please try a different provider or smaller file.");
            }
            const messageValue = typedResult["message"];
            if (typeof messageValue === "string") {
                throw new Error(`Upload returned message: ${messageValue}`);
            }
            const keys = Object.keys(typedResult).join(", ");
            throw new Error(`NIP-96 response missing URL. Keys received: [${keys}]`);
        }

        const kind: AttachmentKind = params.file.type.startsWith("video/") ? "video" : "image";

        return {
            kind,
            url,
            contentType: params.file.type,
            fileName: params.file.name,
        };
    }
}
