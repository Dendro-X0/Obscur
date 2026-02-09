import { Attachment, AttachmentKind } from "../types";
import { UploadService } from "./upload-service";
import { cryptoService, NATIVE_KEY_SENTINEL } from "../../crypto/crypto-service";
import { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { nativeErrorStore } from "../../native/lib/native-error-store";
import { getIdentitySnapshot } from "../../auth/hooks/use-identity";

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

        // Check if running in Tauri
        if (!this.isTauri()) {
            throw new Error("NIP-96 upload requires desktop app");
        }

        // V2: Rust-native path (Option C)
        // We no longer check or migrate keys here. 
        // Rust's nip96_upload_v2 will return NO_SESSION if the session isn't initialized.


        const errors: string[] = [];

        for (const providerUrl of providers) {
            try {
                // console.log("%c[OPTION-C-V2] 🚀 NEW RUST PATH ACTIVE - 2026-02-08-16:11", "background: #00ff00; color: black; font-size: 16px; padding: 4px;");
                console.info(`[NIP96-V2] Uploading to ${providerUrl}`);

                // Read file as bytes
                const arrayBuffer = await file.arrayBuffer();
                const fileBytes = Array.from(new Uint8Array(arrayBuffer));

                // Call Rust backend
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
                    throw new Error(result.message || "Upload failed");
                }

                if (!result.url) {
                    throw new Error("Upload succeeded but no URL returned");
                }

                console.info(`[NIP96-V2] Success: ${result.url}`);

                const kind: AttachmentKind = file.type.startsWith("video/")
                    ? "video"
                    : "image";

                return {
                    kind,
                    url: result.url,
                    contentType: file.type,
                    fileName: file.name,
                };

            } catch (err: any) {
                const msg = getErrorMessage(err);
                console.error(`[NIP96-V2] Failed for ${providerUrl}:`, msg);

                // Handle NO_SESSION specifically (from Rust NativeError)
                if (err?.code === "NO_SESSION" || String(err).includes("NO_SESSION")) {
                    throw new Error("Native session expired or not initialized. Please LOCK and UNLOCK your screen to refresh your session.");
                }

                errors.push(`${providerUrl}: ${msg}`);
            }
        }

        throw new Error(`All providers failed: ${errors.join(" | ")}`);
    }

    private async cleanupOldUploadPaths(): Promise<void> {
        // This method can be called once to clean up any legacy state if needed
    }
}
