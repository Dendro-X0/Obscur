import { nip04Decrypt } from "@dweb/nostr/nip04-decrypt";
import { nip04Encrypt } from "@dweb/nostr/nip04-encrypt";
import { createNostrEvent } from "@dweb/nostr/create-nostr-event";
import { verifyNostrEventSignature } from "@dweb/nostr/verify-nostr-event-signature";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { toBase64 } from "@dweb/crypto/to-base64";
import { fromBase64 } from "@dweb/crypto/from-base64";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { schnorr } from "@noble/curves/secp256k1";
import { nip44 } from "nostr-tools";
import type {
    CryptoService,
    SecurityUtils,
    UnsignedNostrEvent,
    InviteSignaturePayload,
    InviteData
} from "./crypto-interfaces";

/**
 * Security utilities implementation
 */
export class SecurityUtilsImpl implements SecurityUtils {
    clearSensitiveString(str: string): void {
        if (!str || typeof str !== 'string') return;
        try {
            // Best effort in JS
            '\0'.repeat(str.length);
        } catch { }
    }

    clearSensitiveBuffer(buffer: Uint8Array): void {
        if (!buffer || !(buffer instanceof Uint8Array)) return;
        try {
            buffer.fill(0);
            crypto.getRandomValues(buffer);
            buffer.fill(0);
        } catch { }
    }

    constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
        if (!a || !b || !(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
        const maxLength = Math.max(a.length, b.length);
        let result = a.length === b.length ? 0 : 1;
        for (let i = 0; i < maxLength; i++) {
            const aVal = a[i % a.length] || 0;
            const bVal = b[i % b.length] || 0;
            result |= aVal ^ bVal;
        }
        return result === 0;
    }

    constantTimeStringCompare(a: string, b: string): boolean {
        if (typeof a !== 'string' || typeof b !== 'string') return false;
        const encoder = new TextEncoder();
        const aBytes = encoder.encode(a);
        const bBytes = encoder.encode(b);
        const result = this.constantTimeCompare(aBytes, bBytes);
        this.clearSensitiveBuffer(aBytes);
        this.clearSensitiveBuffer(bBytes);
        return result;
    }

    sanitizeForLogging(data: any): any {
        if (data === null || data === undefined) return data;
        if (typeof data !== 'object') return data;
        if (data instanceof Error) return { name: data.name, message: data.message };
        if (Array.isArray(data)) return data.map(item => this.sanitizeForLogging(item));

        const sanitized: any = {};
        const sensitiveKeys = [
            'privatekey', 'privkey', 'private_key', 'sk',
            'password', 'passphrase', 'secret', 'token',
            'key', 'keys', 'seed', 'mnemonic',
            'content', 'plaintext', 'ciphertext', 'encrypted',
            'signature', 'sig'
        ];

        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));
            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeForLogging(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
}

/**
 * Crypto service implementation
 */
export class CryptoServiceImpl implements CryptoService {
    public readonly security: SecurityUtils;

    constructor() {
        this.security = new SecurityUtilsImpl();
    }

    async encryptDM(plaintext: string, recipientPubkey: PublicKeyHex, senderPrivkey: PrivateKeyHex): Promise<string> {
        let plaintextBytes: Uint8Array | null = null;
        try {
            const encoder = new TextEncoder();
            plaintextBytes = encoder.encode(plaintext);
            return await nip04Encrypt({
                senderPrivateKeyHex: senderPrivkey,
                recipientPublicKeyHex: recipientPubkey,
                plaintext
            });
        } finally {
            if (plaintextBytes) this.security.clearSensitiveBuffer(plaintextBytes);
            this.security.clearSensitiveString(plaintext);
        }
    }

    async decryptDM(ciphertext: string, senderPubkey: PublicKeyHex, recipientPrivkey: PrivateKeyHex): Promise<string> {
        let decryptedBytes: Uint8Array | null = null;
        try {
            const decrypted = await nip04Decrypt({
                recipientPrivateKeyHex: recipientPrivkey,
                senderPublicKeyHex: senderPubkey,
                payload: ciphertext
            });
            const encoder = new TextEncoder();
            decryptedBytes = encoder.encode(decrypted);
            return decrypted;
        } finally {
            if (decryptedBytes) this.security.clearSensitiveBuffer(decryptedBytes);
        }
    }

    async signEvent(event: UnsignedNostrEvent, privateKey: PrivateKeyHex): Promise<NostrEvent> {
        return await createNostrEvent({
            kind: event.kind,
            content: event.content,
            tags: event.tags,
            privateKeyHex: privateKey
        });
    }

    async verifyEventSignature(event: NostrEvent): Promise<boolean> {
        try {
            return await verifyNostrEventSignature(event);
        } catch (error) {
            console.warn("Signature verification failed:", await this.security.sanitizeForLogging(error));
            return false;
        }
    }

    async generateKeyPair(): Promise<{ publicKey: PublicKeyHex; privateKey: PrivateKeyHex }> {
        const privateKey = generatePrivateKeyHex();
        const publicKey = derivePublicKeyHex(privateKey);
        return { publicKey, privateKey };
    }

    async deriveSharedSecret(privateKey: PrivateKeyHex, publicKey: PublicKeyHex): Promise<Uint8Array> {
        const combined = privateKey + publicKey;
        const encoder = new TextEncoder();
        const bytes = encoder.encode(combined);
        const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
        return new Uint8Array(hashBuffer);
    }

    async generateInviteId(): Promise<string> {
        const randomBytes = await this.generateSecureRandom(16);
        return this.bytesToHex(randomBytes);
    }

    async signInviteData(data: InviteSignaturePayload, privateKey: PrivateKeyHex): Promise<string> {
        const canonicalData = this.canonicalizeData(data);
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(encoder.encode(canonicalData)));
        const hashHex = this.bytesToHex(new Uint8Array(hashBuffer));
        const signature = await schnorr.sign(hashHex, privateKey);
        return this.bytesToHex(signature);
    }

    async verifyInviteSignature(data: InviteSignaturePayload, signature: string, publicKey: PublicKeyHex): Promise<boolean> {
        try {
            const canonicalData = this.canonicalizeData(data);
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', toArrayBuffer(encoder.encode(canonicalData)));
            const hashHex = this.bytesToHex(new Uint8Array(hashBuffer));
            return schnorr.verify(signature, hashHex, publicKey);
        } catch {
            return false;
        }
    }

    async encryptInviteData(data: string, key: Uint8Array): Promise<string> {
        const iv = await this.generateSecureRandom(12);
        const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(key), { name: 'AES-GCM' }, false, ['encrypt']);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(new TextEncoder().encode(data)));
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        return toBase64(combined);
    }

    async decryptInviteData(encryptedData: string, key: Uint8Array): Promise<string> {
        const combined = fromBase64(encryptedData);
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(key), { name: 'AES-GCM' }, false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(encrypted));
        return new TextDecoder().decode(decrypted);
    }

    async generateSecureRandom(length: number): Promise<Uint8Array> {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return bytes;
    }

    async isValidPubkey(pubkey: string): Promise<boolean> {
        return /^[0-9a-fA-F]{64}$/.test(pubkey.trim());
    }

    async normalizeKey(key: string): Promise<string> {
        const normalized = key.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
        return normalized.length === 64 ? normalized : '';
    }

    async encryptGiftWrap(rumor: UnsignedNostrEvent, senderPrivkey: PrivateKeyHex, recipientPubkey: PublicKeyHex): Promise<NostrEvent> {
        const signedRumor = await this.signEvent(rumor, senderPrivkey);
        const sessionKey = generatePrivateKeyHex();
        const sessionPubkey = derivePublicKeyHex(sessionKey);
        const sealContent = JSON.stringify(signedRumor);
        const conversationKeySeal = nip44.v2.utils.getConversationKey(this.hexToBytes(senderPrivkey), recipientPubkey);
        const encryptedSealContent = nip44.v2.encrypt(sealContent, conversationKeySeal);
        const seal: UnsignedNostrEvent = {
            kind: 13,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: encryptedSealContent,
            pubkey: sessionPubkey
        };
        const signedSeal = await this.signEvent(seal, senderPrivkey);
        const wrapKey = generatePrivateKeyHex();
        const wrapPubkey = derivePublicKeyHex(wrapKey);
        const wrapContent = JSON.stringify(signedSeal);
        const conversationKeyWrap = nip44.v2.utils.getConversationKey(this.hexToBytes(wrapKey), recipientPubkey);
        const encryptedWrapContent = nip44.v2.encrypt(wrapContent, conversationKeyWrap);
        const wrap: UnsignedNostrEvent = {
            kind: 1059,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', recipientPubkey]],
            content: encryptedWrapContent,
            pubkey: wrapPubkey
        };
        return await this.signEvent(wrap, wrapKey);
    }

    async decryptGiftWrap(giftWrap: NostrEvent, recipientPrivkey: PrivateKeyHex): Promise<NostrEvent> {
        if (giftWrap.kind !== 1059) throw new Error("Not a gift wrap");
        const conversationKeyWrap = nip44.v2.utils.getConversationKey(this.hexToBytes(recipientPrivkey), giftWrap.pubkey);
        const sealJson = nip44.v2.decrypt(giftWrap.content, conversationKeyWrap);
        const seal = JSON.parse(sealJson) as NostrEvent;
        if (seal.kind !== 13) throw new Error("Invalid seal kind");
        const conversationKeySeal = nip44.v2.utils.getConversationKey(this.hexToBytes(recipientPrivkey), seal.pubkey);
        const rumorJson = nip44.v2.decrypt(seal.content, conversationKeySeal);
        return JSON.parse(rumorJson) as NostrEvent;
    }

    private hexToBytes(hex: string): Uint8Array {
        if (!hex || typeof hex !== 'string') return new Uint8Array(32);

        // Remove 0x prefix if present
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

        // If not valid hex, return zeros to avoid exceptions in crypto ops (though they will fail later)
        if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
            console.warn("Invalid hex string provided to hexToBytes");
            return new Uint8Array(32);
        }

        const bytes = new Uint8Array(32);
        // Better parsing loop
        for (let i = 0; i < 32; i++) {
            const byteStr = cleanHex.slice(i * 2, i * 2 + 2);
            if (byteStr.length < 2) break;
            bytes[i] = parseInt(byteStr, 16);
        }
        return bytes;
    }

    private bytesToHex(bytes: Uint8Array): string {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private canonicalizeData(data: any): string {
        const keys = Object.keys(data).sort();
        return keys.map(k => `${k}:${typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]}`).join('|');
    }
}
