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
            const npub = await invoke<string | null>("get_native_npub");
            this.hasNativeKeyCached = npub !== null;
            return this.hasNativeKeyCached;
        } catch (e) {
            console.error("Failed to check native key:", e);
            return false;
        }
    }

    async getNativeNpub(): Promise<string | null> {
        return await invoke<string | null>("get_native_npub");
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
        const npub = await invoke<string>("import_native_nsec", { nsec });
        this.hasNativeKeyCached = true;
        return npub;
    }

    async deleteNativeKey(): Promise<void> {
        await invoke("logout_native");
        this.hasNativeKeyCached = false;
    }
}
