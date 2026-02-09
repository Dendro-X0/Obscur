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
    private hasNativeKeyCached: boolean | null = null;

    async hasNativeKey(): Promise<boolean> {
        if (this.hasNativeKeyCached !== null) return this.hasNativeKeyCached;
        try {
            // In the new architecture, we check if a session is ACTIVE in memory
            const npub = await invoke<string | null>("get_native_npub");
            this.hasNativeKeyCached = npub !== null;
            return this.hasNativeKeyCached;
        } catch (e) {
            this.hasNativeKeyCached = false;
            return false;
        }
    }

    async initNativeSession(nsec: string): Promise<string> {
        console.info("[NativeCrypto] Initializing native session...");
        const response = await invoke<{ success: boolean; npub?: string; message?: string }>("init_native_session", { nsec });
        if (!response.success) {
            throw new Error(response.message || "Failed to initialize native session");
        }
        this.hasNativeKeyCached = true;
        return response.npub!;
    }

    async clearNativeSession(): Promise<void> {
        await invoke("clear_native_session");
        this.hasNativeKeyCached = false;
    }

    async getNativeNpub(): Promise<string | null> {
        try {
            return await invoke<string | null>("get_native_npub");
        } catch (e) {
            const errorMsg = String(e);
            if (errorMsg.includes("not supported")) {
                return null;
            }
            throw e;
        }
    }

    async signEvent(event: UnsignedNostrEvent, privateKey: PrivateKeyHex): Promise<NostrEvent> {
        if (privateKey === NATIVE_KEY_SENTINEL || (await this.hasNativeKey())) {
            try {
                return await invoke<NostrEvent>("sign_event_native", {
                    req: {
                        kind: event.kind,
                        content: event.content,
                        tags: event.tags,
                        created_at: event.created_at
                    }
                });
            } catch (e) {
                console.error("Native signing failed, falling back if possible:", e);
                if (privateKey !== NATIVE_KEY_SENTINEL) {
                    return super.signEvent(event, privateKey);
                }
                throw e;
            }
        }
        return super.signEvent(event, privateKey);
    }

    async generateKeyPair(): Promise<{ publicKey: PublicKeyHex; privateKey: PrivateKeyHex }> {
        try {
            const publicKey = await invoke<string>("generate_native_nsec");
            this.hasNativeKeyCached = true;
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
        const npub = await invoke<string>("import_native_nsec", { nsec });
        this.hasNativeKeyCached = true;
        return npub;
    }

    async deleteNativeKey(): Promise<void> {
        // This command now clears BOTH keychain and in-memory session
        await invoke("logout_native");
        this.hasNativeKeyCached = false;
    }

    async encryptDM(plaintext: string, recipientPubkey: PublicKeyHex, senderPrivkey: PrivateKeyHex): Promise<string> {
        if (senderPrivkey === NATIVE_KEY_SENTINEL || (await this.hasNativeKey())) {
            try {
                return await invoke<string>("encrypt_nip04", { publicKey: recipientPubkey, content: plaintext });
            } catch (e) {
                console.error("Native encryption failed, falling back if possible:", e);
                if (senderPrivkey !== NATIVE_KEY_SENTINEL) {
                    return super.encryptDM(plaintext, recipientPubkey, senderPrivkey);
                }
                throw e;
            }
        }
        return super.encryptDM(plaintext, recipientPubkey, senderPrivkey);
    }

    async decryptDM(ciphertext: string, senderPubkey: PublicKeyHex, recipientPrivkey: PrivateKeyHex): Promise<string> {
        if (recipientPrivkey === NATIVE_KEY_SENTINEL || (await this.hasNativeKey())) {
            try {
                return await invoke<string>("decrypt_nip04", { publicKey: senderPubkey, ciphertext });
            } catch (e) {
                console.error("Native decryption failed, falling back if possible:", e);
                if (recipientPrivkey !== NATIVE_KEY_SENTINEL) {
                    return super.decryptDM(ciphertext, senderPubkey, recipientPrivkey);
                }
                throw e;
            }
        }
        return super.decryptDM(ciphertext, senderPubkey, recipientPrivkey);
    }
}
