import { Attachment, AttachmentKind, UploadError, UploadErrorCode } from "../types";
import { UploadService, getAttachmentKind, getMimeType } from "./upload-service";
import { compressImage } from "./media-processor";
import {
    BEST_EFFORT_STORAGE_NOTE,
    shouldPreferBrowserUploadForRuntimeSafety,
    shouldCompressByPolicy,
    validateMediaFileForBestEffortUpload
} from "./media-upload-policy";
import { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { createNostrEvent } from "@dweb/nostr/create-nostr-event";
import { toBase64 } from "@dweb/crypto/to-base64";
import { getRuntimeHostInfo, hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import type { DeliveryReasonCode } from "@dweb/core/security-foundation-contracts";
import { normalizePublicUrl } from "@/app/shared/public-url";
import { reportDevRuntimeIssue } from "@/app/shared/dev-runtime-issue-reporter";

export interface Nip96Config {
    apiUrl?: string;
    apiUrls?: ReadonlyArray<string>;
    enabled: boolean;
}

export const STORAGE_KEY_NIP96 = "obscur.storage.nip96";
export const getNip96StorageKey = (): string => getScopedStorageKey(STORAGE_KEY_NIP96);

type Nip96Event = Readonly<{
    tags?: ReadonlyArray<ReadonlyArray<string>>;
}>;

type Nip96Response = Readonly<Record<string, unknown>>;
const BROWSER_FETCH_TIMEOUT_MS = 45_000;
const BROWSER_PROVIDER_TIMEOUT_MS = 60_000;
const DEV_BROWSER_PROVIDER_TIMEOUT_MS = 20_000;
const DEV_TAURI_PROVIDER_TIMEOUT_MS = 30_000;
const TAURI_PROVIDER_TIMEOUT_MS = 45_000;
const WELL_KNOWN_DISCOVERY_TIMEOUT_MS = 7_500;
const HEX_PRIVATE_KEY_REGEX = /^[0-9a-f]{64}$/i;
const DEV_UPLOAD_BROWSER_FIRST =
    process.env.NEXT_PUBLIC_UPLOAD_DEV_BROWSER_FIRST === "1"
    || process.env.NEXT_PUBLIC_UPLOAD_DEV_BROWSER_FIRST === "true";
const DEV_ALLOW_TAURI_BROWSER_FALLBACK =
    process.env.NEXT_PUBLIC_UPLOAD_ALLOW_TAURI_BROWSER_FALLBACK === "1"
    || process.env.NEXT_PUBLIC_UPLOAD_ALLOW_TAURI_BROWSER_FALLBACK === "true";
const WEB_UPLOAD_ENABLE_LOCAL_API_FALLBACK =
    process.env.NEXT_PUBLIC_UPLOAD_ENABLE_LOCAL_API_FALLBACK === "1"
    || process.env.NEXT_PUBLIC_UPLOAD_ENABLE_LOCAL_API_FALLBACK === "true";

type UploadOutcome = Readonly<{
    status: "failed";
    reasonCode: DeliveryReasonCode;
    retryable: boolean;
    message: string;
}>;

const classifyUploadError = (error: UploadError): UploadOutcome => {
    if (error.code === UploadErrorCode.NETWORK_ERROR) {
        const message = error.message || "Network upload error";
        const timeoutLike = /timeout|timed out/i.test(message);
        return {
            status: "failed",
            reasonCode: timeoutLike ? "upload_timeout" : "provider_unavailable",
            retryable: true,
            message,
        };
    }
    if (error.code === UploadErrorCode.PROVIDER_ERROR) {
        return {
            status: "failed",
            reasonCode: "upload_provider_failed",
            retryable: true,
            message: error.message || "Upload provider failed",
        };
    }
    if (error.code === UploadErrorCode.AUTH_MISSING_KEY || error.code === UploadErrorCode.NO_SESSION || error.code === UploadErrorCode.AUTH_ERROR) {
        return {
            status: "failed",
            reasonCode: "unsupported_runtime",
            retryable: false,
            message: error.message || "Upload authentication unavailable",
        };
    }
    return {
        status: "failed",
        reasonCode: "failed",
        retryable: false,
        message: error.message || "Upload failed",
    };
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
    private resolvedFallbackPrivateKeyHex: string | null | undefined = undefined;
    private providerUploadTargetCache = new Map<string, ReadonlyArray<string>>();
    private providerRotationCursor = 0;

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

    private rotateProvidersForAttempt(providers: ReadonlyArray<string>): ReadonlyArray<string> {
        if (providers.length <= 1) {
            return providers;
        }
        const offset = this.providerRotationCursor % providers.length;
        this.providerRotationCursor += 1;
        if (offset === 0) {
            return providers;
        }
        return [
            ...providers.slice(offset),
            ...providers.slice(0, offset),
        ];
    }

    private isTauri(): boolean {
        return hasNativeRuntime();
    }

    private shouldPreferBrowserPathInDev(): boolean {
        if (!this.isTauri() || typeof window === "undefined" || !DEV_UPLOAD_BROWSER_FIRST) {
            return false;
        }
        return getRuntimeHostInfo().isLocalDevelopment;
    }

    private shouldUseFastDevNativeTimeouts(): boolean {
        if (!this.isTauri() || typeof window === "undefined") {
            return false;
        }
        return getRuntimeHostInfo().isLocalDevelopment;
    }

    private shouldAllowBrowserFallback(providerUrl: string): boolean {
        if (!this.isTauri()) {
            return true;
        }
        if (typeof window === "undefined") {
            return true;
        }
        const isLocalDevHost = getRuntimeHostInfo().isLocalDevelopment;
        if (isLocalDevHost && !DEV_ALLOW_TAURI_BROWSER_FALLBACK) {
            return false;
        }
        // If explicitly enabled, allow fallback even in tauri dev.
        void providerUrl;
        return true;
    }

    private shouldUseLocalApiFallbackInWeb(): boolean {
        if (this.isTauri()) {
            return false;
        }
        if (typeof window === "undefined") {
            return false;
        }
        return WEB_UPLOAD_ENABLE_LOCAL_API_FALLBACK || getRuntimeHostInfo().isLocalDevelopment;
    }

    public static toRootUploadVariants(url: string): ReadonlyArray<string> {
        try {
            const parsed = new URL(url);
            const origin = parsed.origin;
            return Array.from(new Set([origin, `${origin}/`]));
        } catch {
            return [url];
        }
    }

    private static normalizeUploadTarget(url: string): string {
        const trimmed = url.trim();
        try {
            return new URL(trimmed).toString();
        } catch {
            return trimmed;
        }
    }

    private async resolveApiUrlFromWellKnown(originUrl: string): Promise<string | null> {
        const origin = originUrl.replace(/\/+$/, "");
        const endpoint = `${origin}/.well-known/nostr/nip96.json`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WELL_KNOWN_DISCOVERY_TIMEOUT_MS);
        try {
            const response = await fetch(endpoint, {
                method: "GET",
                signal: controller.signal,
            });
            if (!response.ok) return null;
            const data = await response.json() as Readonly<Record<string, unknown>>;
            const apiUrl = typeof data.api_url === "string" ? data.api_url.trim() : "";
            if (!apiUrl) return null;
            return Nip96UploadService.normalizeUploadTarget(apiUrl);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                reportDevRuntimeIssue({
                    domain: "upload",
                    operation: "provider_discovery",
                    severity: "warn",
                    reasonCode: "upload_provider_discovery_timeout",
                    message: `NIP-96 provider discovery timed out after ${WELL_KNOWN_DISCOVERY_TIMEOUT_MS}ms`,
                    retryable: true,
                    source: "nip96-upload-service",
                    context: {
                        endpoint,
                        timeoutMs: WELL_KNOWN_DISCOVERY_TIMEOUT_MS,
                    },
                    fingerprint: `upload|provider_discovery|${origin}`,
                });
            }
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async resolveBrowserUploadTargets(providerUrl: string): Promise<ReadonlyArray<string>> {
        const normalizedProvider = providerUrl.trim();
        if (!normalizedProvider) {
            return [];
        }
        const cached = this.providerUploadTargetCache.get(normalizedProvider);
        if (cached) {
            return cached;
        }

        const discovered: string[] = [];
        const direct: string[] = [];
        const add = (list: string[], value: string | null | undefined): void => {
            if (!value) return;
            const normalized = Nip96UploadService.normalizeUploadTarget(value);
            if (!normalized) return;
            if (!list.includes(normalized)) {
                list.push(normalized);
            }
        };

        add(direct, normalizedProvider);

        try {
            const parsed = new URL(normalizedProvider);
            const rootPath = parsed.pathname === "" || parsed.pathname === "/";
            if (rootPath) {
                for (const variant of Nip96UploadService.toRootUploadVariants(parsed.origin)) {
                    add(direct, variant);
                }
            }

            const apiUrlFromSameOrigin = await this.resolveApiUrlFromWellKnown(parsed.origin);
            add(discovered, apiUrlFromSameOrigin);

            if (!apiUrlFromSameOrigin && parsed.hostname.startsWith("cdn.")) {
                const parentHostOrigin = `${parsed.protocol}//${parsed.hostname.slice(4)}`;
                const apiUrlFromParent = await this.resolveApiUrlFromWellKnown(parentHostOrigin);
                add(discovered, apiUrlFromParent);
            }
        } catch {
            // Ignore parse/discovery errors and keep direct targets only.
        }

        const merged = Array.from(new Set([...discovered, ...direct]));
        this.providerUploadTargetCache.set(normalizedProvider, merged);
        return merged;
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
            const sessionKeyResult = await invokeNativeCommand<string>("get_session_nsec");
            if (sessionKeyResult.ok && typeof sessionKeyResult.value === "string" && HEX_PRIVATE_KEY_REGEX.test(sessionKeyResult.value)) {
                this.resolvedFallbackPrivateKeyHex = sessionKeyResult.value;
                return sessionKeyResult.value;
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

    private async uploadViaTauriWithFallback(
        file: File,
        providerUrl: string,
        nativeTimeoutMs = TAURI_PROVIDER_TIMEOUT_MS,
        browserFallbackTimeoutMs = BROWSER_PROVIDER_TIMEOUT_MS
    ): Promise<Attachment> {
        try {
            return await this.withTimeout(
                this.uploadViaTauri(file, providerUrl),
                nativeTimeoutMs,
                `native provider ${providerUrl}`
            );
        } catch (err: any) {
            const nativeError = err instanceof UploadError
                ? err
                : new UploadError(UploadErrorCode.UNKNOWN, err?.message || String(err));

            if (!this.isRetryableNativeUploadError(nativeError)) {
                throw nativeError;
            }

            if (!this.shouldAllowBrowserFallback(providerUrl)) {
                if (nativeError.code === UploadErrorCode.NETWORK_ERROR) {
                    throw new UploadError(
                        UploadErrorCode.NETWORK_ERROR,
                        `${nativeError.message} (browser fallback disabled in tauri dev to avoid CORS false-failures)`
                    );
                }
                throw nativeError;
            }

            const browserFallbackKey = await this.resolveFallbackPrivateKeyHex();
            if (!browserFallbackKey) {
                throw nativeError;
            }

            console.warn("[NIP96] Native upload failed, trying browser fallback for provider:", providerUrl, nativeError.message);
            return this.withTimeout(
                this.uploadViaBrowser(file, providerUrl, browserFallbackKey),
                browserFallbackTimeoutMs,
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
        const preferBrowserForRuntimeSafety = shouldPreferBrowserUploadForRuntimeSafety(uploadFile, this.isTauri());
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
        providers = [...this.rotateProvidersForAttempt(providers)];

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
                    if (preferBrowserForRuntimeSafety) {
                        const browserKey = await this.resolveFallbackPrivateKeyHex();
                        if (!browserKey) {
                            throw new UploadError(
                                UploadErrorCode.FILE_TOO_LARGE,
                                `${uploadFile.name} is too large for the native upload path on this runtime. Use a smaller file or external link. ${BEST_EFFORT_STORAGE_NOTE}`
                            );
                        }
                        this.logTelemetry("upload.attempt", {
                            providerUrl,
                            path: "browser-runtime-safety",
                            timeoutMs: BROWSER_PROVIDER_TIMEOUT_MS
                        });
                        attachment = await this.withTimeout(
                            this.uploadViaBrowser(uploadFile, providerUrl, browserKey),
                            BROWSER_PROVIDER_TIMEOUT_MS,
                            `browser runtime-safe provider ${providerUrl}`
                        );
                    } else if (this.shouldPreferBrowserPathInDev()) {
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
                                timeoutMs: DEV_TAURI_PROVIDER_TIMEOUT_MS
                            });
                            attachment = await this.withTimeout(
                                this.uploadViaTauri(uploadFile, providerUrl),
                                DEV_TAURI_PROVIDER_TIMEOUT_MS,
                                `native provider ${providerUrl}`
                            );
                        }
                    } else {
                        const nativeTimeoutMs = this.shouldUseFastDevNativeTimeouts()
                            ? DEV_TAURI_PROVIDER_TIMEOUT_MS
                            : TAURI_PROVIDER_TIMEOUT_MS;
                        const browserFallbackTimeoutMs = this.shouldUseFastDevNativeTimeouts()
                            ? DEV_BROWSER_PROVIDER_TIMEOUT_MS
                            : BROWSER_PROVIDER_TIMEOUT_MS;
                        this.logTelemetry("upload.attempt", {
                            providerUrl,
                            path: "tauri-native-with-fallback",
                            timeoutMs: nativeTimeoutMs
                        });
                        attachment = await this.uploadViaTauriWithFallback(
                            uploadFile,
                            providerUrl,
                            nativeTimeoutMs,
                            browserFallbackTimeoutMs
                        );
                    }
                } else {
                    const uploadTargets = await this.resolveBrowserUploadTargets(providerUrl);
                    const providerErrors: UploadError[] = [];
                    let providerAttachment: Attachment | null = null;

                    for (const targetUrl of uploadTargets) {
                        try {
                            this.logTelemetry("upload.attempt", {
                                providerUrl,
                                targetUrl,
                                path: "browser",
                                timeoutMs: BROWSER_PROVIDER_TIMEOUT_MS
                            });
                            providerAttachment = await this.withTimeout(
                                this.uploadViaBrowser(uploadFile, targetUrl),
                                BROWSER_PROVIDER_TIMEOUT_MS,
                                `browser provider ${targetUrl}`
                            );
                            break;
                        } catch (innerErr: any) {
                            const uploadError = innerErr instanceof UploadError
                                ? innerErr
                                : new UploadError(UploadErrorCode.UNKNOWN, innerErr?.message || String(innerErr));
                            providerErrors.push(uploadError);
                        }
                    }

                    if (!providerAttachment) {
                        throw providerErrors[providerErrors.length - 1] || new UploadError(UploadErrorCode.PROVIDER_ERROR, `Browser upload failed for provider ${providerUrl}`);
                    }
                    attachment = providerAttachment;
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

        if (!this.isTauri() && this.shouldUseLocalApiFallbackInWeb()) {
            try {
                this.logTelemetry("upload.attempt", {
                    providerUrl: "local:/api/upload",
                    path: "browser-local-fallback",
                    timeoutMs: BROWSER_PROVIDER_TIMEOUT_MS,
                });
                const localAttachment = await this.withTimeout(
                    this.uploadViaLocalApi(uploadFile),
                    BROWSER_PROVIDER_TIMEOUT_MS,
                    "local browser fallback /api/upload"
                );
                this.logTelemetry("upload.success", {
                    providerUrl: "local:/api/upload",
                    latencyMs: Date.now() - startTime,
                    url: localAttachment.url,
                    fallback: true,
                });
                return localAttachment;
            } catch (localErr: any) {
                const uploadError = localErr instanceof UploadError
                    ? localErr
                    : new UploadError(UploadErrorCode.UNKNOWN, localErr?.message || String(localErr));
                errors.push(uploadError);
            }
        }

        const lastError = errors[errors.length - 1];
        const normalizedOutcome = lastError ? classifyUploadError(lastError) : null;
        this.logTelemetry("upload.failed", {
            latencyMs: Date.now() - startTime,
            errorCount: errors.length,
            lastErrorCode: lastError?.code,
            lastErrorMessage: lastError?.message,
            reasonCode: normalizedOutcome?.reasonCode,
            retryable: normalizedOutcome?.retryable
        });
        reportDevRuntimeIssue({
            domain: "upload",
            operation: "upload_file",
            severity: "error",
            reasonCode: normalizedOutcome?.reasonCode ?? "upload_failed",
            message: normalizedOutcome?.message
                || lastError?.message
                || "Upload failed without a specific provider error.",
            retryable: normalizedOutcome?.retryable,
            source: "nip96-upload-service",
            context: {
                providerCount: providers.length,
                errorCount: errors.length,
                fileSize: uploadFile.size,
                fileKind: kind,
                isNativeRuntime: this.isTauri(),
                lastErrorCode: lastError?.code ?? null,
            },
            fingerprint: [
                "upload",
                kind,
                normalizedOutcome?.reasonCode ?? "upload_failed",
                lastError?.code ?? "unknown",
            ].join("|"),
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
        interface UploadResult {
            status: string;
            url: string | null;
            message: string | null;
            nip94_event?: any;
        }

        try {
            const nativeResult = await invokeNativeCommand<UploadResult>("nip96_upload_v2", {
                apiUrl: providerUrl.trim(),
                fileBytes,
                fileName: file.name,
                contentType: file.type || getMimeType(file.name),
            });
            if (!nativeResult.ok) {
                throw new UploadError(UploadErrorCode.PROVIDER_ERROR, nativeResult.message || "Native upload command failed");
            }
            const result = nativeResult.value;

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
                url: normalizePublicUrl(result.url),
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
                url: normalizePublicUrl(url),
                contentType: file.type,
                fileName: file.name,
            };
        }

        throw errors[errors.length - 1] || new UploadError(UploadErrorCode.UNKNOWN, "Upload failed unexpectedly");
    }

    private async uploadViaLocalApi(file: File): Promise<Attachment> {
        const formData = new FormData();
        formData.append("file", file);

        let response: Response;
        try {
            response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
        } catch (e) {
            throw new UploadError(UploadErrorCode.NETWORK_ERROR, `Local API upload failed: ${e}`);
        }

        if (!response.ok) {
            let errorMessage = `Local API upload failed with status ${response.status}`;
            try {
                const body = await response.json() as Readonly<Record<string, unknown>>;
                if (typeof body.error === "string" && body.error.trim()) {
                    errorMessage = body.error;
                }
            } catch {
                // Ignore response parse failures.
            }
            throw new UploadError(UploadErrorCode.PROVIDER_ERROR, errorMessage);
        }

        const result = await response.json() as Readonly<Record<string, unknown>>;
        const rawUrl = typeof result.url === "string" ? result.url : "";
        const contentType = typeof result.contentType === "string" ? result.contentType : (file.type || getMimeType(file.name));
        if (!rawUrl) {
            throw new UploadError(UploadErrorCode.PROVIDER_ERROR, "Local API upload succeeded but URL is missing");
        }

        return {
            kind: getAttachmentKind(file),
            url: normalizePublicUrl(rawUrl),
            contentType,
            fileName: file.name,
        };
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

export const nip96UploadInternals = {
    classifyUploadError,
    toRootUploadVariants: Nip96UploadService.toRootUploadVariants,
    wellKnownDiscoveryTimeoutMs: WELL_KNOWN_DISCOVERY_TIMEOUT_MS,
};
