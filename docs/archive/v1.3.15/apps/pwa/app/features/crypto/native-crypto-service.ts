import { CryptoServiceImpl } from "./crypto-service-impl";
import type {
    CryptoService,
    UnsignedNostrEvent,
    NostrEvent,
    PublicKeyHex,
    PrivateKeyHex
} from "./crypto-interfaces";
import { classifyDecryptFailure } from "@/app/features/messaging/lib/decrypt-failure-classifier";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";

export const NATIVE_KEY_SENTINEL = "native" as PrivateKeyHex;
const DEFAULT_NATIVE_COMMAND_TIMEOUT_MS = 15_000;
const NATIVE_SESSION_DISCOVERY_TIMEOUT_MS = 3_000;

const toHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
};

const toRumorIdPayload = (rumor: Readonly<Pick<UnsignedNostrEvent, "pubkey" | "created_at" | "kind" | "tags" | "content">>): string => {
    return JSON.stringify([0, rumor.pubkey, rumor.created_at, rumor.kind, rumor.tags, rumor.content]);
};

const fallbackDigestHex = (payload: string): string => {
    // Lightweight deterministic fallback if SubtleCrypto is unavailable.
    let hash = 0x811c9dc5;
    for (let i = 0; i < payload.length; i += 1) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0").repeat(8);
};

const deriveRumorEventId = async (
    rumor: Readonly<Pick<UnsignedNostrEvent, "pubkey" | "created_at" | "kind" | "tags" | "content">>
): Promise<string> => {
    const payload = toRumorIdPayload(rumor);
    try {
        const encoded = new TextEncoder().encode(payload);
        const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(encoded));
        return toHex(new Uint8Array(digest));
    } catch {
        return fallbackDigestHex(payload);
    }
};

const resolveRumorEventId = async (
    rumor: Readonly<Pick<UnsignedNostrEvent, "id" | "pubkey" | "created_at" | "kind" | "tags" | "content">>
): Promise<string> => {
    const explicitId = typeof rumor.id === "string" ? rumor.id.trim() : "";
    if (explicitId.length > 0) {
        return explicitId;
    }
    return deriveRumorEventId(rumor);
};

export class NativeCryptoService extends CryptoServiceImpl implements CryptoService {
    private actualKeyHex: PrivateKeyHex | null = null;
    private hasNativeKeyCached: boolean | null = null;

    /**
     * Invalidate cached identity information.
     * Must be called when switching profiles or logging out to ensure state is re-fetched.
     */
    invalidateCache(): void {
        this.actualKeyHex = null;
        this.hasNativeKeyCached = null;
    }

    private async invokeWithTimeout<T>(command: string, args?: any, timeoutMs: number = DEFAULT_NATIVE_COMMAND_TIMEOUT_MS): Promise<T> {
        const result = await invokeNativeCommand<T>(command, args, { timeoutMs });
        if (!result.ok) {
            // Compatibility fallback for mixed native payload envelopes while desktop runtime migrates.
            if ((result.message || "").includes("Version not found in payload")) {
                const { invoke } = await import("@tauri-apps/api/core");
                // Do not add a second timeout layer here; keep one canonical timeout contract.
                return invoke<T>(command, args);
            }
            throw new Error(result.message || `Native command ${command} failed`);
        }
        return result.value;
    }

    private async invokeWithoutTimeout<T>(command: string, args?: any): Promise<T> {
        const result = await invokeNativeCommand<T>(command, args);
        if (!result.ok) {
            if ((result.message || "").includes("Version not found in payload")) {
                const { invoke } = await import("@tauri-apps/api/core");
                return invoke<T>(command, args);
            }
            throw new Error(result.message || `Native command ${command} failed`);
        }
        return result.value;
    }

    private async getActualKey(): Promise<PrivateKeyHex> {
        if (this.actualKeyHex) return this.actualKeyHex;
        try {
            const nsec = await this.invokeWithTimeout<string>("get_session_nsec");
            this.actualKeyHex = nsec as PrivateKeyHex;
            return this.actualKeyHex;
        } catch (e) {
            logRuntimeEvent(
                "native_crypto.get_actual_key_failed",
                "actionable",
                ["Failed to get actual key from session:", e]
            );
            throw e;
        }
    }

    private async resolveFallbackPrivateKey(privateKey: PrivateKeyHex): Promise<PrivateKeyHex> {
        if (privateKey !== NATIVE_KEY_SENTINEL) {
            return privateKey;
        }
        return this.getActualKey();
    }

    async hasNativeKey(): Promise<boolean> {
        if (this.hasNativeKeyCached !== null) return this.hasNativeKeyCached;
        try {
            const npub = await this.invokeWithTimeout<string | null>(
                "get_native_npub",
                undefined,
                NATIVE_SESSION_DISCOVERY_TIMEOUT_MS,
            );
            this.hasNativeKeyCached = npub !== null;
            return this.hasNativeKeyCached;
        } catch (e) {
            this.hasNativeKeyCached = false;
            return false;
        }
    }

    async initNativeSession(nsec: string): Promise<string> {
        console.info("[NativeCrypto] Initializing native session...");
        const response = await this.invokeWithoutTimeout<{ success: boolean; npub?: string; message?: string }>(
            "init_native_session",
            { nsec }
        );
        if (!response.success) {
            throw new Error(response.message || "Failed to initialize native session");
        }
        this.hasNativeKeyCached = true;
        this.actualKeyHex = null;
        return response.npub!;
    }

    async clearNativeSession(): Promise<void> {
        await this.invokeWithTimeout("clear_native_session");
        this.hasNativeKeyCached = false;
        this.actualKeyHex = null;
    }

    async getNativeNpub(): Promise<string | null> {
        try {
            return await this.invokeWithTimeout<string | null>(
                "get_native_npub",
                undefined,
                NATIVE_SESSION_DISCOVERY_TIMEOUT_MS,
            );
        } catch (e) {
            const errorMsg = String(e);
            if (errorMsg.includes("not supported")) {
                return null;
            }
            throw e;
        }
    }

    async signEvent(event: UnsignedNostrEvent, privateKey: PrivateKeyHex): Promise<NostrEvent> {
        // Only use native signing if explicitly requested via sentinel.
        // If a real hex key is passed (e.g. ephemeral key for GiftWrap), use JS implementation.
        if (privateKey === NATIVE_KEY_SENTINEL) {
            try {
                // Use native Rust signer - this is the proven, working path
                return await this.invokeWithTimeout<NostrEvent>("sign_event_native", {
                    req: {
                        kind: event.kind,
                        content: event.content,
                        tags: event.tags,
                        created_at: event.created_at
                    }
                });
            } catch (e) {
                logRuntimeEvent(
                    "native_crypto.sign_event_native_failed",
                    "degraded",
                    ["Native signing failed, falling back if possible:", e]
                );
                const fallbackKey = await this.resolveFallbackPrivateKey(privateKey);
                return super.signEvent(event, fallbackKey);
            }
        }
        return super.signEvent(event, privateKey);
    }

    async generateKeyPair(): Promise<{ publicKey: PublicKeyHex; privateKey: PrivateKeyHex }> {
        try {
            const publicKey = await this.invokeWithTimeout<string>("generate_native_nsec");
            this.hasNativeKeyCached = true;
            this.actualKeyHex = null;
            return {
                publicKey: publicKey as PublicKeyHex,
                privateKey: NATIVE_KEY_SENTINEL
            };
        } catch (e) {
            logRuntimeEvent(
                "native_crypto.generate_keypair_failed",
                "degraded",
                ["Native key generation failed, falling back to web:", e]
            );
            return super.generateKeyPair();
        }
    }

    async importNsec(nsec: string): Promise<string> {
        // This command now updates BOTH keychain and in-memory session
        const npub = await this.invokeWithTimeout<string>("import_native_nsec", { nsec });
        this.hasNativeKeyCached = true;
        this.actualKeyHex = null;
        return npub;
    }

    async deleteNativeKey(): Promise<void> {
        // This command now clears BOTH keychain and in-memory session
        await this.invokeWithTimeout("logout_native");
        this.hasNativeKeyCached = false;
        this.actualKeyHex = null;
    }

    async encryptDM(plaintext: string, recipientPubkey: PublicKeyHex, senderPrivkey: PrivateKeyHex): Promise<string> {
        // Only use native encryption if using the sentinel (identity) key.
        if (senderPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                return await this.invokeWithTimeout<string>("encrypt_nip04", { publicKey: recipientPubkey, content: plaintext });
            } catch (e) {
                logRuntimeEvent(
                    "native_crypto.encrypt_nip04_failed",
                    "degraded",
                    ["Native encryption failed:", e]
                );
                const fallbackKey = await this.resolveFallbackPrivateKey(senderPrivkey);
                return super.encryptDM(plaintext, recipientPubkey, fallbackKey);
            }
        }
        return super.encryptDM(plaintext, recipientPubkey, senderPrivkey);
    }

    async decryptDM(ciphertext: string, senderPubkey: PublicKeyHex, recipientPrivkey: PrivateKeyHex): Promise<string> {
        // Only use native decryption if using the sentinel (identity) key.
        if (recipientPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                return await this.invokeWithTimeout<string>("decrypt_nip04", { publicKey: senderPubkey, ciphertext });
            } catch (e) {
                const classification = classifyDecryptFailure(e);
                logRuntimeEvent(
                    `native_crypto.decrypt_nip04_failed.${classification.reason}`,
                    classification.runtimeClass,
                    ["Native decryption failed:", e]
                );
                const fallbackKey = await this.resolveFallbackPrivateKey(recipientPrivkey);
                return super.decryptDM(ciphertext, senderPubkey, fallbackKey);
            }
        }
        return super.decryptDM(ciphertext, senderPubkey, recipientPrivkey);
    }

    async encryptNIP44(plaintext: string, recipientPubkey: PublicKeyHex, senderPrivkey: PrivateKeyHex): Promise<string> {
        if (senderPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                return await this.invokeWithTimeout<string>("encrypt_nip44", { publicKey: recipientPubkey, content: plaintext });
            } catch (e) {
                logRuntimeEvent(
                    "native_crypto.encrypt_nip44_failed",
                    "degraded",
                    ["Native NIP-44 encryption failed:", e]
                );
                const fallbackKey = await this.resolveFallbackPrivateKey(senderPrivkey);
                return super.encryptNIP44(plaintext, recipientPubkey, fallbackKey);
            }
        }
        return super.encryptNIP44(plaintext, recipientPubkey, senderPrivkey);
    }

    async decryptNIP44(payload: string, senderPubkey: PublicKeyHex, recipientPrivkey: PrivateKeyHex): Promise<string> {
        if (recipientPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                return await this.invokeWithTimeout<string>("decrypt_nip44", { publicKey: senderPubkey, payload });
            } catch (e) {
                const classification = classifyDecryptFailure(e);
                logRuntimeEvent(
                    `native_crypto.decrypt_nip44_failed.${classification.reason}`,
                    classification.runtimeClass,
                    ["Native NIP-44 decryption failed:", e]
                );
                const fallbackKey = await this.resolveFallbackPrivateKey(recipientPrivkey);
                return super.decryptNIP44(payload, senderPubkey, fallbackKey);
            }
        }
        return super.decryptNIP44(payload, senderPubkey, recipientPrivkey);
    }

    async encryptGiftWrap(rumor: UnsignedNostrEvent, senderPrivkey: PrivateKeyHex, recipientPubkey: PublicKeyHex): Promise<NostrEvent> {
        if (senderPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                const rumorId = await resolveRumorEventId(rumor);
                const rumorForNative = {
                    ...rumor,
                    id: rumorId
                };
                const signedGiftWrapJson = await this.invokeWithTimeout<string>("encrypt_gift_wrap", {
                    recipientPk: recipientPubkey,
                    rumor: rumorForNative
                });
                return JSON.parse(signedGiftWrapJson);
            } catch (e) {
                logRuntimeEvent(
                    "native_crypto.encrypt_gift_wrap_failed",
                    "degraded",
                    ["Native encryptGiftWrap failed:", e]
                );
                const fallbackKey = await this.resolveFallbackPrivateKey(senderPrivkey);
                return super.encryptGiftWrap(rumor, fallbackKey, recipientPubkey);
            }
        }
        return super.encryptGiftWrap(rumor, senderPrivkey, recipientPubkey);
    }

    async decryptGiftWrap(giftWrap: NostrEvent, recipientPrivkey: PrivateKeyHex): Promise<NostrEvent> {
        if (recipientPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                const rumor = await this.invokeWithTimeout<UnsignedNostrEvent>("decrypt_gift_wrap", {
                    giftWrapContent: giftWrap.content,
                    giftWrapSenderPk: giftWrap.pubkey
                });

                const rumorId = await resolveRumorEventId(rumor);
                const hydratedRumor = {
                    ...rumor,
                    id: rumorId,
                    sig: (rumor as any).sig || ""
                } as unknown as NostrEvent;

                return hydratedRumor;
            } catch (e) {
                const classification = classifyDecryptFailure(e);
                logRuntimeEvent(
                    `native_crypto.decrypt_gift_wrap_failed.${classification.reason}`,
                    classification.runtimeClass,
                    ["Native decryptGiftWrap failed:", e]
                );
                const fallbackKey = await this.resolveFallbackPrivateKey(recipientPrivkey);
                return super.decryptGiftWrap(giftWrap, fallbackKey);
            }
        }
        return super.decryptGiftWrap(giftWrap, recipientPrivkey);
    }
}

export const nativeCryptoServiceInternals = {
    deriveRumorEventId,
    resolveRumorEventId,
    fallbackDigestHex,
    NATIVE_SESSION_DISCOVERY_TIMEOUT_MS,
};
