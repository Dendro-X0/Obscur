import { Attachment, AttachmentKind } from "../types";
import { UploadService } from "./upload-service";
import { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { createNostrEvent } from "@dweb/nostr/create-nostr-event";
import { toBase64 } from "@dweb/crypto/to-base64";

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

type NativeInvokeError = Readonly<{
    code?: unknown;
    message?: unknown;
}>;

const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === "string") {
        return err;
    }
    if (err && typeof err === "object") {
        const asNative = err as NativeInvokeError;
        if (typeof asNative.message === "string") {
            return asNative.message;
        }
        try {
            return JSON.stringify(err);
        } catch {
            return "Unknown error";
        }
    }
    return String(err);
};

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
            throw new Error("No NIP-96 providers configured");
        }

        const errors: string[] = [];

        for (const providerUrl of providers) {
            try {
                if (this.isTauri()) {
                    return await this.uploadViaTauri(file, providerUrl);
                } else {
                    return await this.uploadViaBrowser(file, providerUrl);
                }
            } catch (err: any) {
                const msg = getErrorMessage(err);
                console.error(`[NIP96] Failed for ${providerUrl}:`, msg);
                errors.push(`${providerUrl}: ${msg}`);
            }
        }

        throw new Error(`All providers failed: ${errors.join(" | ")}`);
    }

    async pickFiles(): Promise<File[] | null> {
        // We reuse the same strategy. In a real app we might want to move this helper
        // but for now we'll assumes it's available or we'll duplicate it for simplicity
        // in this specialized service. Actually, I'll export it from upload-service.ts.
        const { pickFilesInternal } = await import("./upload-service");
        return pickFilesInternal();
    }

    private async uploadViaTauri(file: File, providerUrl: string): Promise<Attachment> {
        console.info(`[NIP96-TAURI] Uploading to ${providerUrl}`);

        const arrayBuffer = await file.arrayBuffer();
        const fileBytes = Array.from(new Uint8Array(arrayBuffer));

        const { invoke } = await import("@tauri-apps/api/core");
        interface UploadResult {
            status: string;
            url: string | null;
            message: string | null;
            nip94_event?: any;
        }

        const result = await invoke<UploadResult>("nip96_upload_v2", {
            apiUrl: providerUrl.trim(),
            fileBytes,
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
        });

        if (result.status === "error") {
            // Handle NO_SESSION specifically (from Rust NativeError)
            if (result.message?.includes("NO_SESSION")) {
                throw new Error("Native session expired or not initialized. Please LOCK and UNLOCK your screen to refresh your session.");
            }
            throw new Error(result.message || "Upload failed");
        }

        if (!result.url) {
            throw new Error("Upload succeeded but no URL returned");
        }

        console.info(`[NIP96-TAURI] Success: ${result.url}`);

        return {
            kind: file.type.startsWith("video/") ? "video" : "image",
            url: result.url,
            contentType: file.type,
            fileName: file.name,
        };
    }

    private async uploadViaBrowser(file: File, providerUrl: string): Promise<Attachment> {
        console.info(`[NIP96-BROWSER] Uploading to ${providerUrl}`);

        if (!this.privateKeyHex) {
            throw new Error("Private key required for NIP-98 authentication in browser");
        }

        // 1. Prepare NIP-98 Auth Header
        const authHeader = await this.signNip98Header(providerUrl, "POST", this.privateKeyHex);

        // 2. Prepare Form Data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("caption", file.name);

        // 3. Perform Fetch
        const response = await fetch(providerUrl, {
            method: "POST",
            headers: {
                "Authorization": `Nostr ${authHeader}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        const result = await response.json() as Nip96Response;
        const url = getUrlFromNip96Response(result);

        if (!url) {
            throw new Error("Upload succeeded but no URL found in response");
        }

        console.info(`[NIP96-BROWSER] Success: ${url}`);

        return {
            kind: file.type.startsWith("video/") ? "video" : "image",
            url: url,
            contentType: file.type,
            fileName: file.name,
        };
    }

    private async signNip98Header(url: string, method: string, privateKeyHex: string): Promise<string> {
        const event = await createNostrEvent({
            kind: 27235,
            content: "",
            privateKeyHex: privateKeyHex as PrivateKeyHex,
            tags: [
                ["u", url],
                ["method", method],
            ],
        });

        return toBase64(new TextEncoder().encode(JSON.stringify(event)));
    }
}
