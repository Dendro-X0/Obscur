import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

type PinPayloadV1 = Readonly<{
    version: 1;
    publicKeyHex: string;
    saltB64: string;
    ivB64: string;
    ciphertextB64: string;
}>;

const STORAGE_KEY_PREFIX = "obscur.pin_lock.v1.";

const getLegacyStorageKey = (publicKeyHex: string): string => `${STORAGE_KEY_PREFIX}${publicKeyHex}`;

const getStorageKey = (publicKeyHex: string): string => getScopedStorageKey(getLegacyStorageKey(publicKeyHex));

const toB64 = (bytes: Uint8Array): string => {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary);
};

const fromB64 = (b64: string): Uint8Array => {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const parsePayload = (value: unknown): PinPayloadV1 | null => {
    if (!isRecord(value)) return null;
    const version = value.version;
    if (version !== 1) return null;
    const publicKeyHex = typeof value.publicKeyHex === "string" ? value.publicKeyHex : null;
    const saltB64 = typeof value.saltB64 === "string" ? value.saltB64 : null;
    const ivB64 = typeof value.ivB64 === "string" ? value.ivB64 : null;
    const ciphertextB64 = typeof value.ciphertextB64 === "string" ? value.ciphertextB64 : null;
    if (!publicKeyHex || !saltB64 || !ivB64 || !ciphertextB64) return null;
    return { version: 1, publicKeyHex, saltB64, ivB64, ciphertextB64 };
};

const asArrayBuffer = (u8: Uint8Array): ArrayBuffer => {
    if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
        return u8.buffer as ArrayBuffer;
    }
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
};

const deriveAesKey = async (pin: string, salt: Uint8Array): Promise<CryptoKey> => {
    const enc = new TextEncoder();
    const pinBytes = enc.encode(pin);
    const baseKey = await crypto.subtle.importKey("raw", pinBytes, "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: asArrayBuffer(salt),
            iterations: 150_000,
            hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
};

export class PinLockService {
    static hasPin(publicKeyHex: string): boolean {
        if (typeof window === "undefined") return false;
        try {
            return (
                window.localStorage.getItem(getStorageKey(publicKeyHex)) != null
                || window.localStorage.getItem(getLegacyStorageKey(publicKeyHex)) != null
            );
        } catch {
            return false;
        }
    }

    static removePin(publicKeyHex: string): void {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.removeItem(getStorageKey(publicKeyHex));
            window.localStorage.removeItem(getLegacyStorageKey(publicKeyHex));
        } catch {
            return;
        }
    }

    static async setPin(params: Readonly<{ publicKeyHex: string; privateKeyHex: string; pin: string }>): Promise<void> {
        if (typeof window === "undefined") return;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveAesKey(params.pin, salt);
        const enc = new TextEncoder();
        const plaintext = enc.encode(params.privateKeyHex);
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: asArrayBuffer(iv) }, key, asArrayBuffer(plaintext)));
        const payload: PinPayloadV1 = {
            version: 1,
            publicKeyHex: params.publicKeyHex,
            saltB64: toB64(salt),
            ivB64: toB64(iv),
            ciphertextB64: toB64(ciphertext)
        };
        window.localStorage.setItem(getStorageKey(params.publicKeyHex), JSON.stringify(payload));
    }

    static async unlockWithPin(params: Readonly<{ publicKeyHex: string; pin: string }>): Promise<{ ok: true; privateKeyHex: string } | { ok: false }> {
        if (typeof window === "undefined") return { ok: false };
        try {
            const raw = window.localStorage.getItem(getStorageKey(params.publicKeyHex))
                ?? window.localStorage.getItem(getLegacyStorageKey(params.publicKeyHex));
            if (!raw) return { ok: false };
            const parsed: unknown = JSON.parse(raw);
            const payload = parsePayload(parsed);
            if (!payload) return { ok: false };
            if (payload.publicKeyHex !== params.publicKeyHex) return { ok: false };

            const salt = fromB64(payload.saltB64);
            const iv = fromB64(payload.ivB64);
            const ciphertext = fromB64(payload.ciphertextB64);
            const key = await deriveAesKey(params.pin, salt);
            const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asArrayBuffer(iv) }, key, asArrayBuffer(ciphertext));
            const dec = new TextDecoder();
            const privateKeyHex = dec.decode(plaintextBuf);
            if (!privateKeyHex || privateKeyHex.trim().length === 0) return { ok: false };
            return { ok: true, privateKeyHex };
        } catch {
            return { ok: false };
        }
    }
}
