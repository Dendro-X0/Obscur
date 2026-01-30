import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import type { InviteData } from '../crypto-interfaces';
import { CryptoServiceImpl } from '../crypto-service-impl';

// Mock the underlying crypto functions
vi.mock('@dweb/nostr/nip04-encrypt', () => ({
    nip04Encrypt: vi.fn()
}));

vi.mock('@dweb/nostr/nip04-decrypt', () => ({
    nip04Decrypt: vi.fn()
}));

vi.mock('@dweb/nostr/create-nostr-event', () => ({
    createNostrEvent: vi.fn()
}));

vi.mock('@dweb/nostr/verify-nostr-event-signature', () => ({
    verifyNostrEventSignature: vi.fn()
}));

// Mock Web Crypto API for test environment
let mockRandomCounter = 0;
const mockCrypto = {
    subtle: {
        digest: vi.fn(),
        importKey: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn(),
    },
    getRandomValues: vi.fn((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = (i * 17 + 42 + mockRandomCounter * 7) % 256;
        }
        mockRandomCounter++;
        return array;
    })
};

Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true
});

vi.mock('@noble/curves/secp256k1', () => ({
    schnorr: {
        sign: vi.fn(),
        verify: vi.fn()
    }
}));

describe('CryptoServiceImpl Tests', () => {
    let service: CryptoServiceImpl;
    const validPublicKey: PublicKeyHex = 'a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc' as PublicKeyHex;
    const validPrivateKey: PrivateKeyHex = '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb' as PrivateKeyHex;
    const anotherPublicKey: PublicKeyHex = 'c2047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5' as PublicKeyHex;
    const anotherPrivateKey: PrivateKeyHex = '6dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0ec' as PrivateKeyHex;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockRandomCounter = 0;
        service = new CryptoServiceImpl();

        const { nip04Encrypt } = await import('@dweb/nostr/nip04-encrypt');
        const { nip04Decrypt } = await import('@dweb/nostr/nip04-decrypt');
        const { createNostrEvent } = await import('@dweb/nostr/create-nostr-event');
        const { verifyNostrEventSignature } = await import('@dweb/nostr/verify-nostr-event-signature');
        const { schnorr } = await import('@noble/curves/secp256k1');

        vi.mocked(nip04Encrypt).mockImplementation(async ({ plaintext }: any) => `encrypted_${plaintext}`);
        vi.mocked(nip04Decrypt).mockImplementation(async ({ payload }: any) => payload.replace('encrypted_', ''));

        vi.mocked(createNostrEvent).mockResolvedValue({
            id: 'mock_event_id',
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            content: 'mock_content',
            pubkey: validPublicKey,
            sig: 'mock_signature',
            tags: []
        } as any);

        vi.mocked(verifyNostrEventSignature).mockResolvedValue(true);

        vi.mocked(mockCrypto.subtle.digest).mockImplementation(async () => new Uint8Array(32).buffer);
        vi.mocked(mockCrypto.subtle.importKey).mockResolvedValue({} as CryptoKey);
        vi.mocked(mockCrypto.subtle.encrypt).mockResolvedValue(new Uint8Array(32).buffer);
        vi.mocked(mockCrypto.subtle.decrypt).mockResolvedValue(new TextEncoder().encode('decrypted_data').buffer);

        vi.mocked(schnorr.sign).mockResolvedValue(new Uint8Array(64));
        vi.mocked(schnorr.verify).mockReturnValue(true);
    });

    it('should encrypt and decrypt DM correctly', async () => {
        const message = 'Hello World';
        const encrypted = await service.encryptDM(message, validPublicKey, validPrivateKey);
        expect(encrypted).toBe(`encrypted_${message}`);
        const decrypted = await service.decryptDM(encrypted, validPublicKey, validPrivateKey);
        expect(decrypted).toBe(message);
    });

    it('should sign event', async () => {
        const event = { kind: 1, content: 'test', tags: [], created_at: 123, pubkey: validPublicKey };
        const signed = await service.signEvent(event, validPrivateKey);
        expect(signed.sig).toBe('mock_signature');
    });

    it('should verify signature', async () => {
        const event = { id: '1', sig: 'sig', pubkey: 'pub' } as any;
        const isValid = await service.verifyEventSignature(event);
        expect(isValid).toBe(true);
    });

    it('should generate key pair', async () => {
        const keys = await service.generateKeyPair();
        expect(keys.publicKey).toBeDefined();
        expect(keys.privateKey).toBeDefined();
    });

    it('should normalize keys', async () => {
        expect(await service.normalizeKey('  ' + 'a'.repeat(64) + '  ')).toBe('a'.repeat(64));
        expect(await service.normalizeKey('short')).toBe('');
    });

    it('should validate pubkeys', async () => {
        expect(await service.isValidPubkey('a'.repeat(64))).toBe(true);
        expect(await service.isValidPubkey('invalid')).toBe(false);
    });
});
