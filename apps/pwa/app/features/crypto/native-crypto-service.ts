import { CryptoServiceImpl } from "./crypto-service-impl";
import type {
    CryptoService,
    UnsignedNostrEvent,
    NostrEvent,
    PublicKeyHex,
    PrivateKeyHex,
    InviteSignaturePayload,
} from "./crypto-interfaces";
import { classifyDecryptFailure } from "@/app/features/messaging/lib/decrypt-failure-classifier";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { canonicalizeInviteData } from "./invite-canonical";

export const NATIVE_KEY_SENTINEL = "native" as PrivateKeyHex;
const DEFAULT_NATIVE_COMMAND_TIMEOUT_MS = 15_000;
const NATIVE_SESSION_DISCOVERY_TIMEOUT_MS = 3_000;

/** NIP-01 event id via Rust — fail-closed (no SubtleCrypto / FNV). @see specs/backend/crypto-native-rumor-event-id-design-2026-10.md */
const deriveRumorEventId = async (
    rumor: Readonly<Pick<UnsignedNostrEvent, "pubkey" | "created_at" | "kind" | "tags" | "content">>
): Promise<string> => {
    const result = await invokeNativeCommand<string>(
        "derive_rumor_event_id",
        {
            pubkey: rumor.pubkey,
            createdAt: rumor.created_at,
            kind: rumor.kind,
            tags: rumor.tags,
            content: rumor.content,
        },
        { timeoutMs: DEFAULT_NATIVE_COMMAND_TIMEOUT_MS },
    );
    if (!result.ok) {
        logRuntimeEvent(
            "native_crypto.derive_rumor_event_id_failed",
            "actionable",
            ["Native derive_rumor_event_id failed (fail-closed; no JS digest fallback):", result.message],
        );
        throw new Error(result.message || "Native derive_rumor_event_id failed");
    }
    return result.value;
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

    private async invokeTauriWithTimeout<T>(
        command: string,
        args?: any,
        timeoutMs: number = DEFAULT_NATIVE_COMMAND_TIMEOUT_MS,
    ): Promise<T> {
        const { invoke } = await import("@tauri-apps/api/core");
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`Native command ${command} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        try {
            return await Promise.race([invoke<T>(command, args), timeoutPromise]);
        } finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }

    private async invokeWithTimeout<T>(command: string, args?: any, timeoutMs: number = DEFAULT_NATIVE_COMMAND_TIMEOUT_MS): Promise<T> {
        const result = await invokeNativeCommand<T>(command, args, { timeoutMs });
        if (!result.ok) {
            // Compatibility fallback for mixed native payload envelopes while desktop runtime migrates.
            if ((result.message || "").includes("Version not found in payload")) {
                return this.invokeTauriWithTimeout<T>(command, args, timeoutMs);
            }
            throw new Error(result.message || `Native command ${command} failed`);
        }
        return result.value;
    }

    private async invokeWithoutTimeout<T>(command: string, args?: any): Promise<T> {
        const result = await invokeNativeCommand<T>(command, args);
        if (!result.ok) {
            if ((result.message || "").includes("Version not found in payload")) {
                return this.invokeTauriWithTimeout<T>(command, args, DEFAULT_NATIVE_COMMAND_TIMEOUT_MS);
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

    /** Resolve desktop identity sentinel to hex for JS-only signing (e.g. coordination membership deltas). */
    async resolveIdentityPrivateKeyForSigning(
        privateKey: PrivateKeyHex = NATIVE_KEY_SENTINEL,
    ): Promise<PrivateKeyHex> {
        return this.resolveFallbackPrivateKey(privateKey);
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
        // Sentinel → Rust only (fail-closed). Hex keys (e.g. ephemeral gift-wrap) stay on JS.
        // @see specs/backend/crypto-native-fail-closed-design-2026-10.md
        if (privateKey === NATIVE_KEY_SENTINEL) {
            try {
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
                    "actionable",
                    ["Native signing failed (fail-closed; no JS nsec fallback):", e]
                );
                throw e;
            }
        }
        return super.signEvent(event, privateKey);
    }

    async generateKeyPair(): Promise<{ publicKey: PublicKeyHex; privateKey: PrivateKeyHex }> {
        // Fail-closed on Tauri — never mint a browser-held hex key under NativeCryptoService.
        // @see specs/backend/crypto-native-generate-keypair-fail-closed-design-2026-10.md
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
                "actionable",
                ["Native key generation failed (fail-closed; no web fallback):", e]
            );
            throw e;
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
        if (senderPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                return await this.invokeWithTimeout<string>("encrypt_nip04", { publicKey: recipientPubkey, content: plaintext });
            } catch (e) {
                logRuntimeEvent(
                    "native_crypto.encrypt_nip04_failed",
                    "actionable",
                    ["Native encryption failed (fail-closed; no JS nsec fallback):", e]
                );
                throw e;
            }
        }
        return super.encryptDM(plaintext, recipientPubkey, senderPrivkey);
    }

    async decryptDM(ciphertext: string, senderPubkey: PublicKeyHex, recipientPrivkey: PrivateKeyHex): Promise<string> {
        if (recipientPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                return await this.invokeWithTimeout<string>("decrypt_nip04", { publicKey: senderPubkey, ciphertext });
            } catch (e) {
                const classification = classifyDecryptFailure(e);
                logRuntimeEvent(
                    `native_crypto.decrypt_nip04_failed.${classification.reason}`,
                    classification.runtimeClass,
                    ["Native decryption failed (fail-closed; no JS nsec fallback):", e]
                );
                throw e;
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
                    "actionable",
                    ["Native NIP-44 encryption failed (fail-closed; no JS nsec fallback):", e]
                );
                throw e;
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
                    ["Native NIP-44 decryption failed (fail-closed; no JS nsec fallback):", e]
                );
                throw e;
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
                    "actionable",
                    ["Native encryptGiftWrap failed (fail-closed; no JS nsec fallback):", e]
                );
                throw e;
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
                    ["Native decryptGiftWrap failed (fail-closed; no JS nsec fallback):", e]
                );
                throw e;
            }
        }
        return super.decryptGiftWrap(giftWrap, recipientPrivkey);
    }

    /** Group AES — Rust only on Tauri (wire `?v=1`). @see specs/backend/crypto-native-group-encrypt-design-2026-10.md */
    async generateRoomKey(): Promise<string> {
        try {
            return await this.invokeWithTimeout<string>("generate_group_room_key");
        } catch (e) {
            logRuntimeEvent(
                "native_crypto.generate_group_room_key_failed",
                "actionable",
                ["Native generateRoomKey failed (fail-closed; no JS fallback):", e],
            );
            throw e;
        }
    }

    async encryptGroupMessage(plaintext: string, roomKeyHex: string): Promise<string> {
        try {
            return await this.invokeWithTimeout<string>("encrypt_group_message", {
                plaintext,
                roomKeyHex,
            });
        } catch (e) {
            logRuntimeEvent(
                "native_crypto.encrypt_group_message_failed",
                "actionable",
                ["Native encryptGroupMessage failed (fail-closed; no JS fallback):", e],
            );
            throw e;
        }
    }

    async decryptGroupMessage(ciphertext: string, roomKeyHex: string): Promise<string> {
        try {
            return await this.invokeWithTimeout<string>("decrypt_group_message", {
                ciphertext,
                roomKeyHex,
            });
        } catch (e) {
            const classification = classifyDecryptFailure(e);
            logRuntimeEvent(
                `native_crypto.decrypt_group_message_failed.${classification.reason}`,
                classification.runtimeClass,
                ["Native decryptGroupMessage failed (fail-closed; no JS fallback):", e],
            );
            throw e;
        }
    }

    /** Invite AES — Rust only (wire base64(iv||ct), no ?v=). @see specs/backend/crypto-native-invite-aes-design-2026-10.md */
    async encryptInviteData(data: string, key: Uint8Array): Promise<string> {
        const keyHex = Array.from(key, (b) => b.toString(16).padStart(2, "0")).join("");
        try {
            return await this.invokeWithTimeout<string>("encrypt_invite_data", {
                plaintext: data,
                keyHex,
            });
        } catch (e) {
            logRuntimeEvent(
                "native_crypto.encrypt_invite_data_failed",
                "actionable",
                ["Native encryptInviteData failed (fail-closed; no JS fallback):", e],
            );
            throw e;
        }
    }

    async decryptInviteData(encryptedData: string, key: Uint8Array): Promise<string> {
        const keyHex = Array.from(key, (b) => b.toString(16).padStart(2, "0")).join("");
        try {
            return await this.invokeWithTimeout<string>("decrypt_invite_data", {
                ciphertext: encryptedData,
                keyHex,
            });
        } catch (e) {
            const classification = classifyDecryptFailure(e);
            logRuntimeEvent(
                `native_crypto.decrypt_invite_data_failed.${classification.reason}`,
                classification.runtimeClass,
                ["Native decryptInviteData failed (fail-closed; no JS fallback):", e],
            );
            throw e;
        }
    }

    /** CSPRNG via Rust — fail-closed. @see specs/backend/crypto-native-random-verify-design-2026-10.md */
    async generateSecureRandom(length: number): Promise<Uint8Array> {
        try {
            const hex = await this.invokeWithTimeout<string>("generate_secure_random", { length });
            if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== length * 2) {
                throw new Error("Native generate_secure_random returned invalid hex");
            }
            const out = new Uint8Array(length);
            for (let i = 0; i < length; i += 1) {
                out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
            }
            return out;
        } catch (e) {
            logRuntimeEvent(
                "native_crypto.generate_secure_random_failed",
                "actionable",
                ["Native generateSecureRandom failed (fail-closed; no JS RNG fallback):", e],
            );
            throw e;
        }
    }

    async generateInviteId(): Promise<string> {
        const bytes = await this.generateSecureRandom(16);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }

    async verifyEventSignature(event: NostrEvent): Promise<boolean> {
        try {
            return await this.invokeWithTimeout<boolean>("verify_nostr_event", {
                id: event.id,
                pubkey: event.pubkey,
                createdAt: event.created_at,
                kind: event.kind,
                tags: event.tags,
                content: event.content,
                sig: event.sig,
            });
        } catch (e) {
            logRuntimeEvent(
                "native_crypto.verify_nostr_event_failed",
                "actionable",
                ["Native verifyEventSignature failed (fail-closed; no JS verify fallback):", e],
            );
            throw e;
        }
    }

    /** SHA-256(utf8(sk+pk)) via Rust when sentinel — not ECDH. @see specs/backend/crypto-native-shared-secret-design-2026-10.md */
    async deriveSharedSecret(privateKey: PrivateKeyHex, publicKey: PublicKeyHex): Promise<Uint8Array> {
        if (privateKey === NATIVE_KEY_SENTINEL) {
            try {
                const hex = await this.invokeWithTimeout<string>("derive_shared_secret", {
                    publicKey,
                });
                if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
                    throw new Error("Native derive_shared_secret returned invalid digest");
                }
                const out = new Uint8Array(32);
                for (let i = 0; i < 32; i += 1) {
                    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
                }
                return out;
            } catch (e) {
                logRuntimeEvent(
                    "native_crypto.derive_shared_secret_failed",
                    "actionable",
                    ["Native deriveSharedSecret failed (fail-closed; no JS nsec fallback):", e],
                );
                throw e;
            }
        }
        return super.deriveSharedSecret(privateKey, publicKey);
    }

    /** Invite schnorr — Rust digest+sign when sentinel; hex keys stay on JS. @see specs/backend/crypto-native-invite-sign-design-2026-10.md */
    async signInviteData(data: InviteSignaturePayload, privateKey: PrivateKeyHex): Promise<string> {
        if (privateKey === NATIVE_KEY_SENTINEL) {
            const canonicalData = canonicalizeInviteData(data);
            try {
                return await this.invokeWithTimeout<string>("sign_invite_data", { canonicalData });
            } catch (e) {
                logRuntimeEvent(
                    "native_crypto.sign_invite_data_failed",
                    "actionable",
                    ["Native signInviteData failed (fail-closed; no JS nsec fallback):", e],
                );
                throw e;
            }
        }
        return super.signInviteData(data, privateKey);
    }

    async verifyInviteSignature(
        data: InviteSignaturePayload,
        signature: string,
        publicKey: PublicKeyHex,
    ): Promise<boolean> {
        const canonicalData = canonicalizeInviteData(data);
        try {
            return await this.invokeWithTimeout<boolean>("verify_invite_signature", {
                canonicalData,
                signature,
                publicKey,
            });
        } catch (e) {
            logRuntimeEvent(
                "native_crypto.verify_invite_signature_failed",
                "actionable",
                ["Native verifyInviteSignature failed (fail-closed; no JS digest fallback):", e],
            );
            throw e;
        }
    }
}

export const nativeCryptoServiceInternals = {
    deriveRumorEventId,
    resolveRumorEventId,
    NATIVE_SESSION_DISCOVERY_TIMEOUT_MS,
};
