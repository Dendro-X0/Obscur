import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/**
 * Security utilities for memory cleanup and timing attack prevention
 */
export interface SecurityUtils {
    clearSensitiveString(str: string): void | Promise<void>;
    clearSensitiveBuffer(buffer: Uint8Array): void | Promise<void>;
    constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean | Promise<boolean>;
    constantTimeStringCompare(a: string, b: string): boolean | Promise<boolean>;
    sanitizeForLogging(data: any): any | Promise<any>;
}

/**
 * Enhanced crypto service for secure message operations
 */
export interface CryptoService {
    // NIP-04 Operations
    encryptDM(plaintext: string, recipientPubkey: PublicKeyHex, senderPrivkey: PrivateKeyHex): Promise<string>;
    decryptDM(ciphertext: string, senderPubkey: PublicKeyHex, recipientPrivkey: PrivateKeyHex): Promise<string>;

    // Event Operations
    signEvent(event: UnsignedNostrEvent, privateKey: PrivateKeyHex): Promise<NostrEvent>;
    verifyEventSignature(event: NostrEvent): Promise<boolean>;

    // NIP-17 Operations (Metadata Privacy)
    encryptGiftWrap(rumor: UnsignedNostrEvent, senderPrivkey: PrivateKeyHex, recipientPubkey: PublicKeyHex): Promise<NostrEvent>;
    decryptGiftWrap(giftWrap: NostrEvent, recipientPrivkey: PrivateKeyHex): Promise<NostrEvent>; // Returns the Rumor

    // Key Operations
    generateKeyPair(): Promise<{ publicKey: PublicKeyHex; privateKey: PrivateKeyHex }>;
    deriveSharedSecret(privateKey: PrivateKeyHex, publicKey: PublicKeyHex): Promise<Uint8Array>;

    // Invite-specific Operations
    generateInviteId(): string | Promise<string>;
    signInviteData(data: InviteSignaturePayload, privateKey: PrivateKeyHex): Promise<string>;
    verifyInviteSignature(data: InviteSignaturePayload, signature: string, publicKey: PublicKeyHex): Promise<boolean>;
    encryptInviteData(data: string, key: Uint8Array): Promise<string>;
    decryptInviteData(encryptedData: string, key: Uint8Array): Promise<string>;
    generateSecureRandom(length: number): Uint8Array | Promise<Uint8Array>;

    // Utilities
    isValidPubkey(pubkey: string): boolean | Promise<boolean>;
    normalizeKey(key: string): string | Promise<string>;

    // Security utilities
    security: SecurityUtils;
}

export interface InviteData {
    publicKey: PublicKeyHex;
    displayName?: string;
    avatar?: string;
    message?: string;
    timestamp: number;
    expirationTime: number;
    inviteId: string;
}

export interface InviteSignaturePayload {
    publicKey: PublicKeyHex;
    displayName?: string;
    avatar?: string;
    message?: string;
    timestamp: number;
    expirationTime?: number;
    inviteId?: string;
}

export interface UnsignedNostrEvent {
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
    pubkey: PublicKeyHex;
}
