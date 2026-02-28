import { invoke } from "@tauri-apps/api/core";
import { CryptoServiceImpl } from "./crypto-service-impl";
import type {
    CryptoService,
    UnsignedNostrEvent,
    NostrEvent,
    PublicKeyHex,
    PrivateKeyHex
} from "./crypto-interfaces";

export const NATIVE_KEY_SENTINEL = "native" as PrivateKeyHex;

export class NativeCryptoService extends CryptoServiceImpl implements CryptoService {
    private actualKeyHex: PrivateKeyHex | null = null;
    private hasNativeKeyCached: boolean | null = null;

    private async invokeWithTimeout<T>(command: string, args?: any, timeoutMs: number = 5000): Promise<T> {
        return Promise.race([
            invoke<T>(command, args),
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`Native command ${command} timed out after ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    }

    private async getActualKey(): Promise<PrivateKeyHex> {
        if (this.actualKeyHex) return this.actualKeyHex;
        try {
            const nsec = await this.invokeWithTimeout<string>("get_session_nsec");
            this.actualKeyHex = nsec as PrivateKeyHex;
            return this.actualKeyHex;
        } catch (e) {
            console.error("Failed to get actual key from session:", e);
            throw e;
        }
    }

    async hasNativeKey(): Promise<boolean> {
        if (this.hasNativeKeyCached !== null) return this.hasNativeKeyCached;
        try {
            const npub = await this.invokeWithTimeout<string | null>("get_native_npub");
            this.hasNativeKeyCached = npub !== null;
            return this.hasNativeKeyCached;
        } catch (e) {
            this.hasNativeKeyCached = false;
            return false;
        }
    }

    async initNativeSession(nsec: string): Promise<string> {
        console.info("[NativeCrypto] Initializing native session...");
        const response = await this.invokeWithTimeout<{ success: boolean; npub?: string; message?: string }>("init_native_session", { nsec });
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
            return await this.invokeWithTimeout<string | null>("get_native_npub");
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
                console.error("Native signing failed, falling back if possible:", e);
                // Fallback will likely fail if key is sentinel, but safer than crashing
                return super.signEvent(event, privateKey);
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
            console.error("Native key generation failed, falling back to web:", e);
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
                console.warn("Native encryption failed:", e);
                throw e;
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
                console.warn("Native decryption failed:", e);
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
                console.warn("Native NIP-44 encryption failed:", e);
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
                console.warn("Native NIP-44 decryption failed:", e);
                throw e;
            }
        }
        return super.decryptNIP44(payload, senderPubkey, recipientPrivkey);
    }

    async encryptGiftWrap(rumor: UnsignedNostrEvent, senderPrivkey: PrivateKeyHex, recipientPubkey: PublicKeyHex): Promise<NostrEvent> {
        if (senderPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                // Now using native NIP-17 wrapping from libobscur
                const rumorForNative = {
                    ...rumor,
                    id: "" // Rust will ignore or we can generate a placeholder
                };
                const signedGiftWrapJson = await this.invokeWithTimeout<string>("encrypt_gift_wrap", {
                    recipientPk: recipientPubkey,
                    rumor: rumorForNative
                });
                return JSON.parse(signedGiftWrapJson);
            } catch (e) {
                console.error("Native encryptGiftWrap failed:", e);
                throw e;
            }
        }
        return super.encryptGiftWrap(rumor, senderPrivkey, recipientPubkey);
    }

    async decryptGiftWrap(giftWrap: NostrEvent, recipientPrivkey: PrivateKeyHex): Promise<NostrEvent> {
        if (recipientPrivkey === NATIVE_KEY_SENTINEL) {
            try {
                // Now using native NIP-17 unwrapping from libobscur
                const rumor = await this.invokeWithTimeout<UnsignedNostrEvent>("decrypt_gift_wrap", {
                    giftWrapContent: giftWrap.content,
                    giftWrapSenderPk: giftWrap.pubkey
                });

                // Return as a signed event placeholder (NIP-17 rumors are usually treated as events)
                // If rumor has no id, it might be an unsigned rumor, we should ideally compute it or the Rust side should provide it.
                // For now, ensure we satisfy the NostrEvent interface.
                const hydratedRumor = {
                    ...rumor,
                    id: (rumor as any).id || "computed-locally",
                    sig: (rumor as any).sig || ""
                } as unknown as NostrEvent;

                return hydratedRumor;
            } catch (e) {
                console.error("Native decryptGiftWrap failed:", e);
                throw e;
            }
        }
        return super.decryptGiftWrap(giftWrap, recipientPrivkey);
    }
}
