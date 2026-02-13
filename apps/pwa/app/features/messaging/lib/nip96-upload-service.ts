import { Attachment, AttachmentKind, UploadError, UploadErrorCode } from "../types";
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

    private logTelemetry(event: "upload.started" | "upload.success" | "upload.failed", context: Record<string, any>) {
        console.info(`[TELEMETRY] ${JSON.stringify({
            name: event,
            level: event === "upload.failed" ? "error" : "info",
            atUnixMs: Date.now(),
            scope: "nip96-upload",
            context
        })}`);
    }

    uploadFile = async (file: File): Promise<Attachment> => {
        const providers = this.getProviders();
        if (providers.length === 0) {
            throw new UploadError(UploadErrorCode.UNKNOWN, "No NIP-96 providers configured");
        }

        const errors: UploadError[] = [];
        const startTime = Date.now();

        this.logTelemetry("upload.started", {
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type,
            providerCount: providers.length,
            isNative: this.isTauri()
        });

        for (const providerUrl of providers) {
            try {
                let attachment: Attachment;
                if (this.isTauri()) {
                    attachment = await this.uploadViaTauri(file, providerUrl);
                } else {
                    attachment = await this.uploadViaBrowser(file, providerUrl);
                }

                this.logTelemetry("upload.success", {
                    providerUrl,
                    latencyMs: Date.now() - startTime,
                    url: attachment.url
                });

                return attachment;
            } catch (err: any) {
                const uploadError = err instanceof UploadError
                    ? err
                    : new UploadError(UploadErrorCode.UNKNOWN, err.message || String(err));

                console.error(`[NIP96] Failed for ${providerUrl}:`, uploadError.message);
                errors.push(uploadError);

                // If it's a fatal error (like no session), don't bother retrying other providers
                if (uploadError.code === UploadErrorCode.NO_SESSION ||
                    uploadError.code === UploadErrorCode.AUTH_MISSING_KEY) {
                    break;
                }
            }
        }

        const lastError = errors[errors.length - 1];
        this.logTelemetry("upload.failed", {
            latencyMs: Date.now() - startTime,
            errorCount: errors.length,
            lastErrorCode: lastError?.code,
            lastErrorMessage: lastError?.message
        });

        throw lastError || new UploadError(UploadErrorCode.UNKNOWN, "All providers failed unexpectedly");
    }

    pickFiles = async (): Promise<File[] | null> => {
        const { pickFilesInternal } = await import("./upload-service");
        return pickFilesInternal();
    }

    private async uploadViaTauri(file: File, providerUrl: string): Promise<Attachment> {
        const arrayBuffer = await file.arrayBuffer();
        const fileBytes = Array.from(new Uint8Array(arrayBuffer));

        const { invoke } = await import("@tauri-apps/api/core");
        interface UploadResult {
            status: string;
            url: string | null;
            message: string | null;
            nip94_event?: any;
        }

        try {
            const result = await invoke<UploadResult>("nip96_upload_v2", {
                apiUrl: providerUrl.trim(),
                fileBytes,
                fileName: file.name,
                contentType: file.type || "application/octet-stream",
            });

            if (result.status === "error") {
                // If it came back as "status: error" but didn't throw, 
                // it might be a structured response from the backend
                throw new UploadError(
                    (result.message?.includes("NO_SESSION") ? UploadErrorCode.NO_SESSION : UploadErrorCode.PROVIDER_ERROR),
                    result.message || "Upload failed"
                );
            }

            if (!result.url) {
                throw new UploadError(UploadErrorCode.PROVIDER_ERROR, "Upload succeeded but no URL returned");
            }

            return {
                kind: file.type.startsWith("video/") ? "video" : "image",
                url: result.url,
                contentType: file.type,
                fileName: file.name,
            };
        } catch (err: any) {
            // Check if it's a Tauri-thrown object (NativeError)
            if (err && typeof err === "object" && "code" in err) {
                throw UploadError.fromNative(err);
            }
            throw err;
        }
    }

    private async uploadViaBrowser(file: File, providerUrl: string): Promise<Attachment> {
        if (!this.privateKeyHex) {
            throw new UploadError(UploadErrorCode.AUTH_MISSING_KEY, "Private key required for NIP-98 authentication");
        }

        let authHeader: string;
        try {
            authHeader = await this.signNip98Header(providerUrl, "POST", this.privateKeyHex);
        } catch (e) {
            throw new UploadError(UploadErrorCode.AUTH_ERROR, `Failed to sign NIP-98 header: ${e}`);
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("caption", file.name);

        let response: Response;
        try {
            response = await fetch(providerUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Nostr ${authHeader}`,
                },
                body: formData,
            });
        } catch (e) {
            throw new UploadError(UploadErrorCode.NETWORK_ERROR, `Fetch failed: ${e}`);
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new UploadError(UploadErrorCode.PROVIDER_ERROR, `HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        let result: Nip96Response;
        try {
            result = await response.json() as Nip96Response;
        } catch (e) {
            throw new UploadError(UploadErrorCode.PROVIDER_ERROR, "Failed to parse provider response as JSON");
        }

        const url = getUrlFromNip96Response(result);

        if (!url) {
            throw new UploadError(UploadErrorCode.PROVIDER_ERROR, "Upload succeeded but no URL found in response");
        }

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
