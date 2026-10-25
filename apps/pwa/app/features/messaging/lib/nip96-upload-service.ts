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
import { getRuntimeHostInfo, hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { DeliveryReasonCode } from "@dweb/core/security-foundation-contracts";
import { normalizeAttachmentUrl } from "@/app/shared/public-url";
import { reportDevRuntimeIssue } from "@/app/shared/dev-runtime-issue-reporter";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
    discoverRootProviderApiUrls,
    resolveApiUrlFromWellKnown,
    WELL_KNOWN_DISCOVERY_TIMEOUT_MS,
} from "./nip96-well-known-discovery";

export interface Nip96Config {
    apiUrl?: string;
    apiUrls?: ReadonlyArray<string>;
    enabled: boolean;
}

export const STORAGE_KEY_NIP96 = "obscur.storage.nip96";
export const getNip96StorageKey = (profileId?: string): string => (
  getScopedStorageKey(STORAGE_KEY_NIP96, profileId ?? getResolvedProfileId())
);

type Nip96Event = Readonly<{
    tags?: ReadonlyArray<ReadonlyArray<string>>;
}>;

type Nip96Response = Readonly<Record<string, unknown>>;

/** pick: parse response text and keep only selected fields (OH1 client-payload). */
const pickJson = <T>(text: string, pick: (data: unknown) => T): T => pick(JSON.parse(text) as unknown);

const BROWSER_FETCH_TIMEOUT_MS = 45_000;
const BROWSER_PROVIDER_TIMEOUT_MS = 60_000;
const DEV_BROWSER_PROVIDER_TIMEOUT_MS = 20_000;
const DEV_TAURI_PROVIDER_TIMEOUT_MS = 30_000;
const TAURI_PROVIDER_TIMEOUT_MS = 45_000;
const HEX_PRIVATE_KEY_REGEX = /^[0-9a-f]{64}$/i;
const DEV_UPLOAD_BROWSER_FIRST =
    process.env.NEXT_PUBLIC_UPLOAD_DEV_BROWSER_FIRST === "1"
    || process.env.NEXT_PUBLIC_UPLOAD_DEV_BROWSER_FIRST === "true";
const WEB_UPLOAD_ENABLE_LOCAL_API_FALLBACK =
    process.env.NEXT_PUBLIC_UPLOAD_ENABLE_LOCAL_API_FALLBACK === "1"
    || process.env.NEXT_PUBLIC_UPLOAD_ENABLE_LOCAL_API_FALLBACK === "true";
const MIN_EXPECTED_UPLOAD_THROUGHPUT_BYTES_PER_SECOND = 300 * 1024;
const MIN_UPLOAD_TIMEOUT_MS = 60_000;
const MAX_UPLOAD_TIMEOUT_MS = 8 * 60 * 1000;
const UPLOAD_TIMEOUT_OVERHEAD_MS = 20_000;

const filePayloadHashCache = new WeakMap<File, Promise<string>>();

const computeFilePayloadHashHex = async (file: File): Promise<string> => {
    const cached = filePayloadHashCache.get(file);
    if (cached) {
        return cached;
    }
    const promise = (async (): Promise<string> => {
        const rawBuffer = typeof file.arrayBuffer === "function"
            ? await file.arrayBuffer()
            : await new Response(file).arrayBuffer();
        const payloadBytes = new Uint8Array(rawBuffer);
        const digest = await crypto.subtle.digest("SHA-256", payloadBytes);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    })();
    filePayloadHashCache.set(file, promise);
    return promise;
};

type UploadOutcome = Readonly<{
    status: "failed";
    reasonCode: DeliveryReasonCode;
    retryable: boolean;
    message: string;
}>;

type UploadTransportPath =
    | "browser"
    | "tauri"
    | "local_api_fallback";

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

const resolveUploadTimeoutMs = (params: Readonly<{
    fileSizeBytes: number;
    baselineTimeoutMs: number;
}>): number => {
    const transferBudgetMs = Math.ceil((params.fileSizeBytes / MIN_EXPECTED_UPLOAD_THROUGHPUT_BYTES_PER_SECOND) * 1000);
    return Math.max(
        params.baselineTimeoutMs,
        MIN_UPLOAD_TIMEOUT_MS,
        Math.min(MAX_UPLOAD_TIMEOUT_MS, transferBudgetMs + UPLOAD_TIMEOUT_OVERHEAD_MS),
    );
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

    private listDirectBrowserUploadTargets(providerUrl: string): ReadonlyArray<string> {
        const normalizedProvider = providerUrl.trim();
        if (!normalizedProvider) {
            return [];
        }
        const direct: string[] = [];
        const add = (value: string | null | undefined): void => {
            if (!value) return;
            const normalized = Nip96UploadService.normalizeUploadTarget(value);
            if (!normalized || direct.includes(normalized)) return;
            direct.push(normalized);
        };
        add(normalizedProvider);
        try {
            const parsed = new URL(normalizedProvider);
            const rootPath = parsed.pathname === "" || parsed.pathname === "/";
            if (rootPath) {
                for (const variant of Nip96UploadService.toRootUploadVariants(parsed.origin)) {
                    add(variant);
                }
            }
        } catch {
            // Keep the raw provider URL only.
        }
        return direct;
    }

    /** Background well-known warm — never awaited on the upload critical path. */
    private warmBrowserUploadTargetsFromWellKnown(providerUrl: string): void {
        const normalizedProvider = providerUrl.trim();
        if (!normalizedProvider) {
            return;
        }
        void discoverRootProviderApiUrls(normalizedProvider).then((discovered) => {
            if (discovered.length === 0) {
                return;
            }
            const prior = this.providerUploadTargetCache.get(normalizedProvider)
                ?? this.listDirectBrowserUploadTargets(normalizedProvider);
            this.providerUploadTargetCache.set(
                normalizedProvider,
                Array.from(new Set([...discovered, ...prior])),
            );
        });
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
        const direct = this.listDirectBrowserUploadTargets(normalizedProvider);
        this.providerUploadTargetCache.set(normalizedProvider, direct);
        // Warm discovered api_url for subsequent uploads; do not block this attempt.
        this.warmBrowserUploadTargetsFromWellKnown(normalizedProvider);
        return direct;
    }

    /** Test seam — well-known discovery lives in nip96-well-known-discovery.ts. */
    private resolveApiUrlFromWellKnown(originUrl: string): Promise<string | null> {
        return resolveApiUrlFromWellKnown(originUrl);
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

    private logTransportAttempt(params: Readonly<{
        stage: "started" | "result";
        attemptIndex: number;
        providerUrl: string;
        file: File;
        transportPath: UploadTransportPath;
        timeoutBudgetMs: number;
        targetUrl?: string;
        success?: boolean;
        reasonCode?: DeliveryReasonCode;
        retryable?: boolean;
        errorMessage?: string;
    }>): void {
        logAppEvent({
            name: params.stage === "started"
                ? "messaging.transport.upload_attempt_started"
                : "messaging.transport.upload_attempt_result",
            level: params.stage === "started"
                ? "info"
                : (params.success ? "info" : "warn"),
            scope: { feature: "messaging", action: "upload_attachment" },
            context: {
                attemptIndex: params.attemptIndex,
                providerUrl: params.providerUrl,
                targetUrl: params.targetUrl ?? params.providerUrl,
                transportPath: params.transportPath,
                timeoutBudgetMs: params.timeoutBudgetMs,
                fileName: params.file.name,
                fileSizeBytes: params.file.size,
                attachmentKind: getAttachmentKind(params.file),
                success: params.success ?? null,
                reasonCode: params.reasonCode ?? null,
                retryable: params.retryable ?? null,
                hasErrorMessage: typeof params.errorMessage === "string" && params.errorMessage.length > 0,
            },
        });
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

        // Explicit hex only — never pull get_session_nsec into JS on Tauri.
        // Native uploads sign NIP-98 in Rust (upload.rs). Browser path needs constructor hex.
        // @see specs/backend/nip96-session-nsec-fallback-subtract-design-2026-10.md
        if (this.privateKeyHex && HEX_PRIVATE_KEY_REGEX.test(this.privateKeyHex)) {
            this.resolvedFallbackPrivateKeyHex = this.privateKeyHex;
            return this.resolvedFallbackPrivateKeyHex;
        }

        this.resolvedFallbackPrivateKeyHex = null;
        return null;
    }

    /** Tauri production path — native only (no browser NIP-98 / session-nsec fallback). */
    private async uploadViaTauriNative(
        file: File,
        providerUrl: string,
        attemptIndex: number,
        nativeTimeoutMs = TAURI_PROVIDER_TIMEOUT_MS,
    ): Promise<Attachment> {
        try {
            this.logTransportAttempt({
                stage: "started",
                attemptIndex,
                providerUrl,
                file,
                transportPath: "tauri",
                timeoutBudgetMs: nativeTimeoutMs,
            });
            return await this.withTimeout(
                this.uploadViaTauri(file, providerUrl),
                nativeTimeoutMs,
                `native provider ${providerUrl}`
            );
        } catch (err: unknown) {
            const nativeError = err instanceof UploadError
                ? err
                : new UploadError(UploadErrorCode.UNKNOWN, err instanceof Error ? err.message : String(err));
            const normalizedNativeOutcome = classifyUploadError(nativeError);

            this.logTransportAttempt({
                stage: "result",
                attemptIndex,
                providerUrl,
                file,
                transportPath: "tauri",
                timeoutBudgetMs: nativeTimeoutMs,
                success: false,
                reasonCode: normalizedNativeOutcome.reasonCode,
                retryable: normalizedNativeOutcome.retryable,
                errorMessage: normalizedNativeOutcome.message,
            });
            throw nativeError;
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

        for (const [providerIndex, providerUrl] of providers.entries()) {
            try {
                let attachment: Attachment;
                if (this.isTauri()) {
                    if (this.shouldPreferBrowserPathInDev()) {
                        const browserTimeoutMs = resolveUploadTimeoutMs({
                            fileSizeBytes: uploadFile.size,
                            baselineTimeoutMs: DEV_BROWSER_PROVIDER_TIMEOUT_MS,
                        });
                        this.logTelemetry("upload.attempt", {
                            providerUrl,
                            path: "browser-dev",
                            timeoutMs: browserTimeoutMs
                        });
                        const browserKey = await this.resolveFallbackPrivateKeyHex();
                        if (!browserKey) {
                            throw new UploadError(UploadErrorCode.AUTH_MISSING_KEY, "Missing session key for browser upload in dev");
                        }
                        try {
                            this.logTransportAttempt({
                                stage: "started",
                                attemptIndex: providerIndex + 1,
                                providerUrl,
                                file: uploadFile,
                                transportPath: "browser",
                                timeoutBudgetMs: browserTimeoutMs,
                            });
                            attachment = await this.withTimeout(
                                this.uploadViaBrowser(uploadFile, providerUrl, browserKey, browserTimeoutMs),
                                browserTimeoutMs,
                                `browser provider ${providerUrl}`
                            );
                        } catch {
                            const nativeTimeoutMs = resolveUploadTimeoutMs({
                                fileSizeBytes: uploadFile.size,
                                baselineTimeoutMs: DEV_TAURI_PROVIDER_TIMEOUT_MS,
                            });
                            this.logTelemetry("upload.attempt", {
                                providerUrl,
                                path: "tauri-dev-fallback",
                                timeoutMs: nativeTimeoutMs
                            });
                            this.logTransportAttempt({
                                stage: "started",
                                attemptIndex: providerIndex + 1,
                                providerUrl,
                                file: uploadFile,
                                transportPath: "tauri",
                                timeoutBudgetMs: nativeTimeoutMs,
                            });
                            attachment = await this.withTimeout(
                                this.uploadViaTauri(uploadFile, providerUrl),
                                nativeTimeoutMs,
                                `native provider ${providerUrl}`
                            );
                        }
                    } else {
                        // Track B6 — native only; no tauri_browser_fallback.
                        // @see specs/backend/nip96-tauri-browser-fallback-subtract-design-2026-10.md
                        const nativeTimeoutMs = this.shouldUseFastDevNativeTimeouts()
                            ? DEV_TAURI_PROVIDER_TIMEOUT_MS
                            : TAURI_PROVIDER_TIMEOUT_MS;
                        const resolvedNativeTimeoutMs = resolveUploadTimeoutMs({
                            fileSizeBytes: uploadFile.size,
                            baselineTimeoutMs: nativeTimeoutMs,
                        });
                        this.logTelemetry("upload.attempt", {
                            providerUrl,
                            path: "tauri-native",
                            timeoutMs: resolvedNativeTimeoutMs
                        });
                        attachment = await this.uploadViaTauriNative(
                            uploadFile,
                            providerUrl,
                            providerIndex + 1,
                            resolvedNativeTimeoutMs,
                        );
                    }
                } else {
                    const timeoutMs = resolveUploadTimeoutMs({
                        fileSizeBytes: uploadFile.size,
                        baselineTimeoutMs: BROWSER_PROVIDER_TIMEOUT_MS,
                    });
                    const providerErrors: UploadError[] = [];
                    let providerAttachment: Attachment | null = null;

                    // Prefer cached well-known api_url when warm; otherwise the configured provider URL.
                    // Single target per provider attempt — avoids OH1 sequential target waterfall + double-upload.
                    const uploadTargets = await this.resolveBrowserUploadTargets(providerUrl);
                    const targetUrl = uploadTargets[0] ?? providerUrl;
                    try {
                        this.logTelemetry("upload.attempt", {
                            providerUrl,
                            targetUrl,
                            path: "browser",
                            timeoutMs,
                        });
                        this.logTransportAttempt({
                            stage: "started",
                            attemptIndex: providerIndex + 1,
                            providerUrl,
                            targetUrl,
                            file: uploadFile,
                            transportPath: "browser",
                            timeoutBudgetMs: timeoutMs,
                        });
                        providerAttachment = await this.withTimeout(
                            this.uploadViaBrowser(uploadFile, targetUrl, undefined, timeoutMs),
                            timeoutMs,
                            `browser provider ${targetUrl}`
                        );
                    } catch (innerErr: unknown) {
                        const uploadError = innerErr instanceof UploadError
                            ? innerErr
                            : new UploadError(
                                UploadErrorCode.UNKNOWN,
                                innerErr instanceof Error ? innerErr.message : String(innerErr),
                            );
                        const normalizedOutcome = classifyUploadError(uploadError);
                        this.logTransportAttempt({
                            stage: "result",
                            attemptIndex: providerIndex + 1,
                            providerUrl,
                            targetUrl,
                            file: uploadFile,
                            transportPath: "browser",
                            timeoutBudgetMs: timeoutMs,
                            success: false,
                            reasonCode: normalizedOutcome.reasonCode,
                            retryable: normalizedOutcome.retryable,
                            errorMessage: normalizedOutcome.message,
                        });
                        providerErrors.push(uploadError);
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
                this.logTransportAttempt({
                    stage: "result",
                    attemptIndex: providerIndex + 1,
                    providerUrl,
                    file: uploadFile,
                    transportPath: this.isTauri()
                        ? (this.shouldPreferBrowserPathInDev() ? "browser" : "tauri")
                        : "browser",
                    timeoutBudgetMs: 0,
                    success: true,
                });

                return attachment;
            } catch (err: any) {
                const uploadError = err instanceof UploadError
                    ? err
                    : new UploadError(UploadErrorCode.UNKNOWN, err.message || String(err));
                const normalizedOutcome = classifyUploadError(uploadError);
                const transportPath: UploadTransportPath = this.isTauri()
                    ? (this.shouldPreferBrowserPathInDev() ? "browser" : "tauri")
                    : "browser";
                const baselineTimeoutMs = transportPath === "tauri"
                    ? (this.shouldUseFastDevNativeTimeouts() ? DEV_TAURI_PROVIDER_TIMEOUT_MS : TAURI_PROVIDER_TIMEOUT_MS)
                    : (this.shouldPreferBrowserPathInDev() ? DEV_BROWSER_PROVIDER_TIMEOUT_MS : BROWSER_PROVIDER_TIMEOUT_MS);
                this.logTransportAttempt({
                    stage: "result",
                    attemptIndex: providerIndex + 1,
                    providerUrl,
                    file: uploadFile,
                    transportPath,
                    timeoutBudgetMs: resolveUploadTimeoutMs({
                        fileSizeBytes: uploadFile.size,
                        baselineTimeoutMs,
                    }),
                    success: false,
                    reasonCode: normalizedOutcome.reasonCode,
                    retryable: normalizedOutcome.retryable,
                    errorMessage: normalizedOutcome.message,
                });

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
                const timeoutMs = resolveUploadTimeoutMs({
                    fileSizeBytes: uploadFile.size,
                    baselineTimeoutMs: BROWSER_PROVIDER_TIMEOUT_MS,
                });
                this.logTelemetry("upload.attempt", {
                    providerUrl: "local:/api/upload",
                    path: "browser-local-fallback",
                    timeoutMs,
                });
                this.logTransportAttempt({
                    stage: "started",
                    attemptIndex: providers.length + 1,
                    providerUrl: "local:/api/upload",
                    file: uploadFile,
                    transportPath: "local_api_fallback",
                    timeoutBudgetMs: timeoutMs,
                });
                const localAttachment = await this.withTimeout(
                    this.uploadViaLocalApi(uploadFile),
                    timeoutMs,
                    "local browser fallback /api/upload"
                );
                this.logTelemetry("upload.success", {
                    providerUrl: "local:/api/upload",
                    latencyMs: Date.now() - startTime,
                    url: localAttachment.url,
                    fallback: true,
                });
                this.logTransportAttempt({
                    stage: "result",
                    attemptIndex: providers.length + 1,
                    providerUrl: "local:/api/upload",
                    file: uploadFile,
                    transportPath: "local_api_fallback",
                    timeoutBudgetMs: timeoutMs,
                    success: true,
                });
                return localAttachment;
            } catch (localErr: any) {
                const uploadError = localErr instanceof UploadError
                    ? localErr
                    : new UploadError(UploadErrorCode.UNKNOWN, localErr?.message || String(localErr));
                const normalizedOutcome = classifyUploadError(uploadError);
                this.logTransportAttempt({
                    stage: "result",
                    attemptIndex: providers.length + 1,
                    providerUrl: "local:/api/upload",
                    file: uploadFile,
                    transportPath: "local_api_fallback",
                    timeoutBudgetMs: resolveUploadTimeoutMs({
                        fileSizeBytes: uploadFile.size,
                        baselineTimeoutMs: BROWSER_PROVIDER_TIMEOUT_MS,
                    }),
                    success: false,
                    reasonCode: normalizedOutcome.reasonCode,
                    retryable: normalizedOutcome.retryable,
                    errorMessage: normalizedOutcome.message,
                });
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
                url: normalizeAttachmentUrl(result.url),
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

    private async uploadViaBrowser(
        file: File,
        providerUrl: string,
        overridePrivateKeyHex?: string,
        fetchTimeoutMs: number = BROWSER_FETCH_TIMEOUT_MS,
    ): Promise<Attachment> {
        const signingPrivateKeyHex = overridePrivateKeyHex ?? await this.resolveFallbackPrivateKeyHex();
        if (!signingPrivateKeyHex) {
            throw new UploadError(UploadErrorCode.AUTH_MISSING_KEY, "Private key required for NIP-98 authentication");
        }

        const errors: UploadError[] = [];

        // Some providers are picky about multipart field names.
        // Keep it aligned with the native uploader retries.
        const fieldNames = ["file", "files[]", "files"] as const;

        let authHeader: string;
        try {
            authHeader = await this.signNip98Header(providerUrl, "POST", signingPrivateKeyHex, file);
        } catch (e) {
            throw new UploadError(UploadErrorCode.AUTH_ERROR, `Failed to sign NIP-98 header: ${e}`);
        }

        for (const fieldName of fieldNames) {
            const formData = new FormData();
            formData.append(fieldName, file);
            formData.append("caption", file.name);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
            type BrowserUploadRound =
                | { kind: "ok"; url: string }
                | { kind: "retry_field"; error: UploadError }
                | { kind: "fatal"; error: UploadError }
                | { kind: "network_stop"; error: UploadError };

            let round: BrowserUploadRound;
            try {
                // Single await for POST + body parse (OH1 sequential budget with discovery).
                round = await fetch(providerUrl, {
                    method: "POST",
                    headers: {
                        "Authorization": `Nostr ${authHeader}`,
                    },
                    body: formData,
                    signal: controller.signal,
                }).then(async (response): Promise<BrowserUploadRound> => {
                    const bodyText = await response.text();
                    if (!response.ok) {
                        const err = new UploadError(UploadErrorCode.PROVIDER_ERROR, `HTTP ${response.status}: ${bodyText || response.statusText}`);
                        if (response.status === 400 && bodyText.toLowerCase().includes("no files")) {
                            return { kind: "retry_field", error: err };
                        }
                        return { kind: "fatal", error: err };
                    }
                    let url: string | null = null;
                    try {
                        url = pickJson(bodyText, (data) => getUrlFromNip96Response(data as Nip96Response));
                    } catch {
                        return {
                            kind: "retry_field",
                            error: new UploadError(UploadErrorCode.PROVIDER_ERROR, "Failed to parse provider response as JSON"),
                        };
                    }
                    if (!url) {
                        return {
                            kind: "retry_field",
                            error: new UploadError(UploadErrorCode.PROVIDER_ERROR, "Upload succeeded but no URL found in response"),
                        };
                    }
                    return { kind: "ok", url };
                });
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") {
                    round = {
                        kind: "retry_field",
                        error: new UploadError(UploadErrorCode.NETWORK_ERROR, `Provider timeout after ${fetchTimeoutMs}ms`),
                    };
                } else {
                    const err = new UploadError(UploadErrorCode.NETWORK_ERROR, `Fetch failed: ${e}`);
                    if (e instanceof TypeError || String(e).includes("Fetch failed")) {
                        round = { kind: "network_stop", error: err };
                    } else {
                        round = { kind: "retry_field", error: err };
                    }
                }
            } finally {
                clearTimeout(timeout);
            }

            if (round.kind === "ok") {
                return {
                    kind: getAttachmentKind(file),
                    url: normalizeAttachmentUrl(round.url),
                    contentType: file.type,
                    fileName: file.name,
                };
            }
            errors.push(round.error);
            if (round.kind === "fatal") {
                throw round.error;
            }
            if (round.kind === "network_stop") {
                break;
            }
        }

        throw errors[errors.length - 1] || new UploadError(UploadErrorCode.UNKNOWN, "Upload failed unexpectedly");
    }

    private async uploadViaLocalApi(file: File): Promise<Attachment> {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const picked = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            }).then(async (response) => {
                const bodyText = await response.text();
                if (!response.ok) {
                    let errorMessage = `Local API upload failed with status ${response.status}`;
                    try {
                        const errorBody = pickJson(bodyText, (data) => {
                            if (!data || typeof data !== "object") return null;
                            const error = (data as Readonly<Record<string, unknown>>).error;
                            return typeof error === "string" && error.trim() ? error : null;
                        });
                        if (errorBody) {
                            errorMessage = errorBody;
                        }
                    } catch {
                        // Ignore response parse failures.
                    }
                    throw new UploadError(UploadErrorCode.PROVIDER_ERROR, errorMessage);
                }
                return pickJson(bodyText, (data) => {
                    const result = (data && typeof data === "object")
                        ? data as Readonly<Record<string, unknown>>
                        : {};
                    const rawUrl = typeof result.url === "string" ? result.url : "";
                    const contentType = typeof result.contentType === "string"
                        ? result.contentType
                        : (file.type || getMimeType(file.name));
                    if (!rawUrl) {
                        throw new UploadError(UploadErrorCode.PROVIDER_ERROR, "Local API upload succeeded but URL is missing");
                    }
                    return { rawUrl, contentType };
                });
            });

            return {
                kind: getAttachmentKind(file),
                url: normalizeAttachmentUrl(picked.rawUrl),
                contentType: picked.contentType,
                fileName: file.name,
            };
        } catch (e) {
            if (e instanceof UploadError) {
                throw e;
            }
            throw new UploadError(UploadErrorCode.NETWORK_ERROR, `Local API upload failed: ${e}`);
        }
    }

    private async signNip98Header(url: string, method: string, privateKeyHex: string, file?: File): Promise<string> {
        const tags: Array<[string, string]> = [
            ["u", url],
            ["method", method],
        ];

        // Some NIP-96 servers require payload hashing for authorization,
        // and video uploads are more likely to trigger strict validation.
        if (file) {
            const hashHex = await computeFilePayloadHashHex(file);
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
    resolveUploadTimeoutMs,
    computeFilePayloadHashHex,
    toRootUploadVariants: Nip96UploadService.toRootUploadVariants,
    wellKnownDiscoveryTimeoutMs: WELL_KNOWN_DISCOVERY_TIMEOUT_MS,
    /** Test/helper: resolve constructor-hex only (no get_session_nsec). */
    resolveFallbackPrivateKeyHex: (service: Nip96UploadService) => (
        (service as unknown as {
            resolveFallbackPrivateKeyHex(): Promise<string | null>;
        }).resolveFallbackPrivateKeyHex()
    ),
};
