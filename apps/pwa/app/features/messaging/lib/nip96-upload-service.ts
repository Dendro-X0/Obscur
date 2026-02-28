import { Attachment, AttachmentKind, UploadError, UploadErrorCode } from "../types";
import { UploadService, getAttachmentKind, getMimeType } from "./upload-service";
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
        const kind = getAttachmentKind(file);
        let providers = this.getProviders();

        // Smart Routing: Preference based on media type
        if (kind === "video" || kind === "audio") {
            // Prioritize void.cat or sovbit for video/audio (which allow larger free uploads)
            providers = [...providers].sort((a, b) => {
                const isAV1 = a.includes("void.cat") || a.includes("sovbit");
                const isAV2 = b.includes("void.cat") || b.includes("sovbit");
                if (isAV1 && !isAV2) return -1;
                if (!isAV1 && isAV2) return 1;
                return 0;
            });
        } else {
            // Prioritize nostr.build for images (very reliable for standard images)
            providers = [...providers].sort((a, b) => {
                const isNB1 = a.includes("nostr.build");
                const isNB2 = b.includes("nostr.build");
                if (isNB1 && !isNB2) return -1;
                if (!isNB1 && isNB2) return 1;
                return 0;
            });
        }

        const errors: UploadError[] = [];
        const startTime = Date.now();

        this.logTelemetry("upload.started", {
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type,
            kind,
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
        const fileBytes = new Uint8Array(arrayBuffer);

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
                contentType: file.type || getMimeType(file.name),
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
                kind: getAttachmentKind(file),
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

        const errors: UploadError[] = [];

        // Some providers are picky about multipart field names.
        // Keep it aligned with the native uploader retries.
        const fieldNames = ["file", "files[]", "files"] as const;

        for (const fieldName of fieldNames) {
            let authHeader: string;
            try {
                authHeader = await this.signNip98Header(providerUrl, "POST", this.privateKeyHex, file);
            } catch (e) {
                throw new UploadError(UploadErrorCode.AUTH_ERROR, `Failed to sign NIP-98 header: ${e}`);
            }

            const formData = new FormData();
            formData.append(fieldName, file);
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
                const err = new UploadError(UploadErrorCode.NETWORK_ERROR, `Fetch failed: ${e}`);
                errors.push(err);
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                const err = new UploadError(UploadErrorCode.PROVIDER_ERROR, `HTTP ${response.status}: ${errorText || response.statusText}`);
                errors.push(err);

                // Some providers respond with "no files" for mismatched field names.
                if (response.status === 400 && (errorText || "").toLowerCase().includes("no files")) {
                    continue;
                }

                throw err;
            }

            let result: Nip96Response;
            try {
                result = await response.json() as Nip96Response;
            } catch {
                const err = new UploadError(UploadErrorCode.PROVIDER_ERROR, "Failed to parse provider response as JSON");
                errors.push(err);
                continue;
            }

            const url = getUrlFromNip96Response(result);
            if (!url) {
                const err = new UploadError(UploadErrorCode.PROVIDER_ERROR, "Upload succeeded but no URL found in response");
                errors.push(err);
                continue;
            }

            return {
                kind: getAttachmentKind(file),
                url: url,
                contentType: file.type,
                fileName: file.name,
            };
        }

        throw errors[errors.length - 1] || new UploadError(UploadErrorCode.UNKNOWN, "Upload failed unexpectedly");
    }

    private async signNip98Header(url: string, method: string, privateKeyHex: string, file?: File): Promise<string> {
        const tags: Array<[string, string]> = [
            ["u", url],
            ["method", method],
        ];

        // Some NIP-96 servers require payload hashing for authorization,
        // and video uploads are more likely to trigger strict validation.
        if (file) {
            const payloadBytes = new Uint8Array(await file.arrayBuffer());
            const digest = await crypto.subtle.digest("SHA-256", payloadBytes);
            const hashHex = Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");

            const expirationUnix = Math.floor(Date.now() / 1000) + 120;
            tags.push(["payload", hashHex]);
            tags.push(["expiration", String(expirationUnix)]);
        }

        const event = await createNostrEvent({
            kind: 27235,
            content: "",
            privateKeyHex: privateKeyHex as PrivateKeyHex,
            tags,
        });

        return toBase64(new TextEncoder().encode(JSON.stringify(event)));
    }
}
