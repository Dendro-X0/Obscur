import { Attachment, AttachmentKind, UploadError, UploadErrorCode } from "../types";
import { UploadService, getAttachmentKind, getMimeType } from "./upload-service";
import { compressImage } from "./media-processor";
import {
    BEST_EFFORT_STORAGE_NOTE,
    shouldCompressByPolicy,
    validateMediaFileForBestEffortUpload
} from "./media-upload-policy";
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
const BROWSER_FETCH_TIMEOUT_MS = 45_000;
const BROWSER_PROVIDER_TIMEOUT_MS = 60_000;
const DEV_BROWSER_PROVIDER_TIMEOUT_MS = 20_000;
const DEV_TAURI_FALLBACK_TIMEOUT_MS = 15_000;
const TAURI_PROVIDER_TIMEOUT_MS = 45_000;
const HEX_PRIVATE_KEY_REGEX = /^[0-9a-f]{64}$/i;

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
    private resolvedFallbackPrivateKeyHex: string | null | undefined = undefined;

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

    private shouldPreferBrowserPathInDev(): boolean {
        if (!this.isTauri() || typeof window === "undefined") {
            return false;
        }
        const host = window.location.hostname;
        return host === "localhost" || host === "127.0.0.1";
    }

    private logTelemetry(event: "upload.started" | "upload.success" | "upload.failed" | "upload.attempt", context: Record<string, any>) {
        console.info(`[TELEMETRY] ${JSON.stringify({
            name: event,
            level: event === "upload.failed" ? "error" : "info",
            atUnixMs: Date.now(),
            scope: "nip96-upload",
            context
        })}`);
    }

    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: string): Promise<T> {
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        try {
            return await Promise.race([
                promise,
                new Promise<T>((_, reject) => {
                    timeoutHandle = setTimeout(() => {
                        reject(new UploadError(UploadErrorCode.NETWORK_ERROR, `Upload timed out: ${reason}`));
                    }, timeoutMs);
                }),
            ]);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    private async resolveFallbackPrivateKeyHex(): Promise<string | null> {
        if (this.resolvedFallbackPrivateKeyHex !== undefined) {
            return this.resolvedFallbackPrivateKeyHex;
        }

        if (this.privateKeyHex && HEX_PRIVATE_KEY_REGEX.test(this.privateKeyHex)) {
            this.resolvedFallbackPrivateKeyHex = this.privateKeyHex;
            return this.resolvedFallbackPrivateKeyHex;
        }

        if (!this.isTauri()) {
            this.resolvedFallbackPrivateKeyHex = null;
            return null;
        }

        try {
            const { invoke } = await import("@tauri-apps/api/core");
            const sessionKey = await invoke<string>("get_session_nsec");
            if (typeof sessionKey === "string" && HEX_PRIVATE_KEY_REGEX.test(sessionKey)) {
                this.resolvedFallbackPrivateKeyHex = sessionKey;
                return sessionKey;
            }
        } catch {
            // Ignore and keep fallback disabled.
        }

        this.resolvedFallbackPrivateKeyHex = null;
        return null;
    }

    private isRetryableNativeUploadError(error: UploadError): boolean {
        if (error.code === UploadErrorCode.NO_SESSION || error.code === UploadErrorCode.AUTH_MISSING_KEY) {
            return false;
        }
        if (error.code === UploadErrorCode.NETWORK_ERROR) {
            return true;
        }
        const message = error.message.toLowerCase();
        return message.includes("timeout") ||
            message.includes("network") ||
            message.includes("timed out");
    }

    private async uploadViaTauriWithFallback(file: File, providerUrl: string): Promise<Attachment> {
        try {
            return await this.withTimeout(
                this.uploadViaTauri(file, providerUrl),
                TAURI_PROVIDER_TIMEOUT_MS,
                `native provider ${providerUrl}`
            );
        } catch (err: any) {
            const nativeError = err instanceof UploadError
                ? err
                : new UploadError(UploadErrorCode.UNKNOWN, err?.message || String(err));

            if (!this.isRetryableNativeUploadError(nativeError)) {
                throw nativeError;
            }

            const browserFallbackKey = await this.resolveFallbackPrivateKeyHex();
            if (!browserFallbackKey) {
                throw nativeError;
            }

            console.warn("[NIP96] Native upload failed, trying browser fallback for provider:", providerUrl, nativeError.message);
            return this.withTimeout(
                this.uploadViaBrowser(file, providerUrl, browserFallbackKey),
                BROWSER_PROVIDER_TIMEOUT_MS,
                `browser fallback provider ${providerUrl}`
            );
        }
    }

    uploadFile = async (file: File): Promise<Attachment> => {
        const preValidationError = validateMediaFileForBestEffortUpload(file);
        if (preValidationError) {
            throw new UploadError(UploadErrorCode.FILE_TOO_LARGE, preValidationError);
        }

        let uploadFile = file;
        const kind = getAttachmentKind(uploadFile);
        if (kind === "image" && shouldCompressByPolicy(uploadFile)) {
            uploadFile = await compressImage(uploadFile);
        }

        const postValidationError = validateMediaFileForBestEffortUpload(uploadFile);
        if (postValidationError) {
            throw new UploadError(UploadErrorCode.FILE_TOO_LARGE, postValidationError);
        }

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
            fileName: uploadFile.name,
            fileSize: uploadFile.size,
            contentType: uploadFile.type,
            kind,
            providerCount: providers.length,
            isNative: this.isTauri()
        });

        for (const providerUrl of providers) {
            try {
                let attachment: Attachment;
                if (this.isTauri()) {
                    if (this.shouldPreferBrowserPathInDev()) {
                        this.logTelemetry("upload.attempt", {
                            providerUrl,
                            path: "browser-dev",
                            timeoutMs: DEV_BROWSER_PROVIDER_TIMEOUT_MS
                        });
                        const browserKey = await this.resolveFallbackPrivateKeyHex();
                        if (!browserKey) {
                            throw new UploadError(UploadErrorCode.AUTH_MISSING_KEY, "Missing session key for browser upload in dev");
                        }
                        try {
                            attachment = await this.withTimeout(
                                this.uploadViaBrowser(uploadFile, providerUrl, browserKey),
                                DEV_BROWSER_PROVIDER_TIMEOUT_MS,
                                `browser provider ${providerUrl}`
                            );
                        } catch {
                            this.logTelemetry("upload.attempt", {
                                providerUrl,
                                path: "tauri-dev-fallback",
                                timeoutMs: DEV_TAURI_FALLBACK_TIMEOUT_MS
                            });
                            attachment = await this.withTimeout(
                                this.uploadViaTauri(uploadFile, providerUrl),
                                DEV_TAURI_FALLBACK_TIMEOUT_MS,
                                `native provider ${providerUrl}`
                            );
                        }
                    } else {
                        this.logTelemetry("upload.attempt", {
                            providerUrl,
                            path: "tauri-native-with-fallback",
                            timeoutMs: TAURI_PROVIDER_TIMEOUT_MS
                        });
                        attachment = await this.uploadViaTauriWithFallback(uploadFile, providerUrl);
                    }
                } else {
                    this.logTelemetry("upload.attempt", {
                        providerUrl,
                        path: "browser",
                        timeoutMs: BROWSER_PROVIDER_TIMEOUT_MS
                    });
                    attachment = await this.withTimeout(
                        this.uploadViaBrowser(uploadFile, providerUrl),
                        BROWSER_PROVIDER_TIMEOUT_MS,
                        `browser provider ${providerUrl}`
                    );
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

                // Log only if it's the last provider or a fatal one, otherwise stay silent to avoid dev overlays
                errors.push(uploadError);

                // If it's a fatal error (like no session), don't bother retrying other providers
                if (uploadError.code === UploadErrorCode.NO_SESSION ||
                    uploadError.code === UploadErrorCode.AUTH_MISSING_KEY) {
                    console.error("[NIP96] Fatal error occurred, stopping upload.");
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

        throw lastError || new UploadError(
            UploadErrorCode.UNKNOWN,
            `All providers failed unexpectedly. ${BEST_EFFORT_STORAGE_NOTE}`
        );
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

    private async uploadViaBrowser(file: File, providerUrl: string, overridePrivateKeyHex?: string): Promise<Attachment> {
        const signingPrivateKeyHex = overridePrivateKeyHex ?? await this.resolveFallbackPrivateKeyHex();
        if (!signingPrivateKeyHex) {
            throw new UploadError(UploadErrorCode.AUTH_MISSING_KEY, "Private key required for NIP-98 authentication");
        }

        const errors: UploadError[] = [];

        // Some providers are picky about multipart field names.
        // Keep it aligned with the native uploader retries.
        const fieldNames = ["file", "files[]", "files"] as const;

        for (const fieldName of fieldNames) {
            let authHeader: string;
            try {
                authHeader = await this.signNip98Header(providerUrl, "POST", signingPrivateKeyHex, file);
            } catch (e) {
                throw new UploadError(UploadErrorCode.AUTH_ERROR, `Failed to sign NIP-98 header: ${e}`);
            }

            const formData = new FormData();
            formData.append(fieldName, file);
            formData.append("caption", file.name);

            let response: Response;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), BROWSER_FETCH_TIMEOUT_MS);
            try {
                response = await fetch(providerUrl, {
                    method: "POST",
                    headers: {
                        "Authorization": `Nostr ${authHeader}`,
                    },
                    body: formData,
                    signal: controller.signal,
                });
            } catch (e) {
                clearTimeout(timeout);
                if (e instanceof DOMException && e.name === "AbortError") {
                    const err = new UploadError(UploadErrorCode.NETWORK_ERROR, `Provider timeout after ${BROWSER_FETCH_TIMEOUT_MS}ms`);
                    errors.push(err);
                    continue;
                }
                const err = new UploadError(UploadErrorCode.NETWORK_ERROR, `Fetch failed: ${e}`);
                errors.push(err);
                // If it's a network error (like TypeError: Failed to fetch), retrying different field names 
                // for the same provider is unlikely to fix it.
                if (e instanceof TypeError || String(e).includes("Fetch failed")) {
                    break;
                }
                continue;
            } finally {
                clearTimeout(timeout);
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
